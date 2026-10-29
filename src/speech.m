// TJSpeech — live speech recognition for Turjuman.
// Modes:
//   normal      one language, stops after a pause, partial + final results
//   auto        two languages in parallel on the same audio; the best final result wins (language auto-detect)
//   continuous  one language, never stops by itself; every pause closes a segment and starts a new one
#import <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>
#import <Speech/Speech.h>
#import <QuartzCore/QuartzCore.h>
#import "tj.h"

@interface TJRecSlot : NSObject
@property (nonatomic, copy) NSString *lang;
@property (nonatomic, strong) SFSpeechRecognizer *recognizer;
@property (nonatomic, strong) SFSpeechAudioBufferRecognitionRequest *request;
@property (nonatomic, strong) SFSpeechRecognitionTask *task;
@property (nonatomic, copy) NSString *text;
@property (nonatomic) double conf;
@property (nonatomic, strong) NSArray *segs;
@property (nonatomic) BOOL done;
@property (nonatomic) NSUInteger seg;
@end
@implementation TJRecSlot
@end

@interface TJSpeech ()
@property (atomic, copy) NSArray<SFSpeechAudioBufferRecognitionRequest *> *feed;
@end

@implementation TJSpeech {
    AVAudioEngine *_engine;
    BOOL _tap;
    NSMutableArray<TJRecSlot *> *_slots;
    NSString *_mode;
    NSArray<NSString *> *_langs;
    NSUInteger _session, _seg;
    NSTimer *_silence, *_maxTimer, *_rotateTimer;
    BOOL _stopping;
    CFTimeInterval _lastSpeech;
}

- (instancetype)init {
    if ((self = [super init])) { _slots = [NSMutableArray array]; _mode = @"normal"; }
    return self;
}

- (BOOL)listening { return _engine != nil; }

#pragma mark Start

- (void)startWithOptions:(NSDictionary *)o completion:(void (^)(NSString *))done {
    NSArray *langs = [o[@"langs"] isKindOfClass:[NSArray class]] ? o[@"langs"] : nil;
    NSString *lang = [o[@"lang"] isKindOfClass:[NSString class]] ? o[@"lang"] : @"en-US";
    if (!langs.count) langs = @[ lang ];
    NSString *mode = [o[@"mode"] isKindOfClass:[NSString class]] ? o[@"mode"] : (langs.count > 1 ? @"auto" : @"normal");
    BOOL bt = [o[@"bt"] boolValue];
    [SFSpeechRecognizer requestAuthorization:^(SFSpeechRecognizerAuthorizationStatus st) {
        dispatch_async(dispatch_get_main_queue(), ^{
            if (st != SFSpeechRecognizerAuthorizationStatusAuthorized) { done(@"speech_denied"); return; }
            [[AVAudioSession sharedInstance] requestRecordPermission:^(BOOL granted) {
                dispatch_async(dispatch_get_main_queue(), ^{
                    if (!granted) { done(@"mic_denied"); return; }
                    done([self beginLangs:langs mode:mode bluetooth:bt]);
                });
            }];
        });
    }];
}

- (TJRecSlot *)makeSlot:(NSString *)lang error:(NSString **)err {
    SFSpeechRecognizer *rec = [[SFSpeechRecognizer alloc] initWithLocale:[NSLocale localeWithLocaleIdentifier:lang]];
    if (!rec) { *err = @"unsupported_lang"; return nil; }
    if (!rec.isAvailable) { *err = @"unavailable"; return nil; }
    TJRecSlot *s = [TJRecSlot new];
    s.lang = lang; s.recognizer = rec; s.seg = ++_seg; s.text = @"";
    s.request = [SFSpeechAudioBufferRecognitionRequest new];
    s.request.shouldReportPartialResults = YES;
    if ([s.request respondsToSelector:NSSelectorFromString(@"setAddsPunctuation:")]) [s.request setValue:@YES forKey:@"addsPunctuation"];
    return s;
}

- (void)runSlot:(TJRecSlot *)slot {
    NSUInteger session = _session;
    __weak typeof(self) ws = self;
    __weak TJRecSlot *wslot = slot;
    slot.task = [slot.recognizer recognitionTaskWithRequest:slot.request resultHandler:^(SFSpeechRecognitionResult *result, NSError *error) {
        dispatch_async(dispatch_get_main_queue(), ^{
            TJSpeech *me = ws; TJRecSlot *sl = wslot;
            if (!me || !sl || me->_session != session) return;
            [me slot:sl result:result error:error];
        });
    }];
}

- (NSString *)beginLangs:(NSArray<NSString *> *)langs mode:(NSString *)mode bluetooth:(BOOL)bt {
    [self teardown:YES];
    if (self.beforeStart) self.beforeStart();
    _session++;
    _mode = mode; _langs = langs; _stopping = NO;
    NSString *err = nil;
    for (NSString *l in langs) {
        TJRecSlot *s = [self makeSlot:l error:&err];
        if (!s) { [_slots removeAllObjects]; return err; }
        [_slots addObject:s];
    }
    NSError *e = nil;
    AVAudioSession *as = [AVAudioSession sharedInstance];
    AVAudioSessionCategoryOptions opt = AVAudioSessionCategoryOptionDefaultToSpeaker |
        (bt ? AVAudioSessionCategoryOptionAllowBluetooth : AVAudioSessionCategoryOptionAllowBluetoothA2DP);
    [as setCategory:AVAudioSessionCategoryPlayAndRecord mode:AVAudioSessionModeMeasurement options:opt error:&e];
    if (e) { [_slots removeAllObjects]; return @"audio_session"; }
    [as setActive:YES withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation error:&e];
    if (e) { [_slots removeAllObjects]; return @"audio_session"; }

    AVAudioEngine *eng = [AVAudioEngine new];
    AVAudioInputNode *input = eng.inputNode;
    AVAudioFormat *fmt = [input outputFormatForBus:0];
    if (fmt.sampleRate <= 0 || fmt.channelCount == 0) { [_slots removeAllObjects]; if (self.afterStop) self.afterStop(); return @"no_input"; }
    NSMutableArray *reqs = [NSMutableArray array];
    for (TJRecSlot *s in _slots) [reqs addObject:s.request];
    self.feed = reqs;
    NSUInteger session = _session;
    __weak typeof(self) ws = self;
    __block CFTimeInterval lastLevel = 0;
    [input installTapOnBus:0 bufferSize:1024 format:fmt block:^(AVAudioPCMBuffer *buf, AVAudioTime *when) {
        NSArray *feed = ws.feed;
        for (SFSpeechAudioBufferRecognitionRequest *r in feed) [r appendAudioPCMBuffer:buf];
        CFTimeInterval now = CACurrentMediaTime();
        if (now - lastLevel > 0.07 && buf.floatChannelData && buf.frameLength > 0) {
            lastLevel = now;
            float *d = buf.floatChannelData[0];
            UInt32 n = buf.frameLength;
            double sum = 0;
            for (UInt32 i = 0; i < n; i++) sum += (double)d[i] * d[i];
            double db = 20.0 * log10(sqrt(sum / n) + 1e-7);
            double lvl = fmin(1.0, fmax(0.0, (db + 55.0) / 45.0));
            dispatch_async(dispatch_get_main_queue(), ^{
                TJSpeech *me = ws;
                if (me && me->_session == session && me->_engine) { if (me.emit) me.emit(@"level", @{ @"v": @(lvl) }); }
            });
        }
    }];
    _tap = YES;
    [eng prepare];
    if (![eng startAndReturnError:&e]) {
        [input removeTapOnBus:0]; _tap = NO;
        [_slots removeAllObjects]; self.feed = @[];
        if (self.afterStop) self.afterStop();
        return @"engine";
    }
    _engine = eng;
    _lastSpeech = CACurrentMediaTime();
    for (TJRecSlot *s in _slots) [self runSlot:s];

    BOOL cont = [mode isEqualToString:@"continuous"];
    [self armSilence:cont ? 600 : 7.0];
    [_maxTimer invalidate];
    if (!cont) _maxTimer = [NSTimer scheduledTimerWithTimeInterval:55 repeats:NO block:^(NSTimer *t) { [ws stop]; }];
    else _maxTimer = [NSTimer scheduledTimerWithTimeInterval:7200 repeats:NO block:^(NSTimer *t) { [ws stop]; }];
    if (cont) [self armRotate];
    if (self.emit) self.emit(@"listenState", @{ @"on": @YES, @"lang": langs.count > 1 ? @"auto" : langs.firstObject, @"mode": mode });
    return nil;
}

#pragma mark Results

- (double)avgConf:(SFTranscription *)t {
    if (!t.segments.count) return 0;
    double s = 0; for (SFTranscriptionSegment *g in t.segments) s += g.confidence;
    return s / t.segments.count;
}

- (void)slot:(TJRecSlot *)slot result:(SFSpeechRecognitionResult *)result error:(NSError *)error {
    BOOL cont = [_mode isEqualToString:@"continuous"];
    BOOL autoMode = [_mode isEqualToString:@"auto"];
    if (result) {
        NSString *t = result.bestTranscription.formattedString ?: @"";
        BOOL changed = ![t isEqualToString:slot.text];
        slot.text = t;
        if (result.isFinal) {
            slot.conf = [self avgConf:result.bestTranscription];
            NSMutableArray *segs = [NSMutableArray array];
            for (SFTranscriptionSegment *g in result.bestTranscription.segments) [segs addObject:@{ @"t": g.substring ?: @"", @"c": @(g.confidence) }];
            slot.segs = segs;
        }
        if (changed && t.length) _lastSpeech = CACurrentMediaTime();
        if (!result.isFinal) {
            if (self.emit) self.emit(@"speech", @{ @"text": t, @"final": @NO, @"lang": slot.lang, @"seg": @(slot.seg), @"auto": @(autoMode) });
            if (cont) { if (changed) [self armPause]; }
            else if (changed) [self armSilence:1.6];
        }
    }
    BOOL finished = (result && result.isFinal) || error;
    if (!finished) return;
    slot.done = YES;

    if (cont) {
        if (slot.text.length) {
            if (self.emit) self.emit(@"speech", @{ @"text": slot.text, @"final": @YES, @"lang": slot.lang, @"seg": @(slot.seg), @"conf": @(slot.conf), @"segs": slot.segs ?: @[] });
        }
        [_slots removeObject:slot];
        if (_stopping && !_slots.count) [self teardown:YES];
        return;
    }
    if (autoMode) {
        for (TJRecSlot *s in _slots) if (!s.done) return;
        [self finishAuto];
        return;
    }
    // normal
    if (slot.text.length) {
        if (self.emit) self.emit(@"speech", @{ @"text": slot.text, @"final": @YES, @"lang": slot.lang, @"conf": @(slot.conf), @"segs": slot.segs ?: @[] });
    } else if (error) {
        if (self.emit) self.emit(@"speechError", @{ @"code": @"no_speech" });
    }
    [self teardown:YES];
}

- (void)finishAuto {
    TJRecSlot *best = nil;
    for (TJRecSlot *s in _slots) {
        if (!s.text.length) continue;
        if (!best) { best = s; continue; }
        double a = s.conf, b = best.conf;
        if (a > b + 0.04 || (fabs(a - b) <= 0.04 && s.text.length > best.text.length)) best = s;
    }
    if (best) {
        if (self.emit) self.emit(@"speech", @{ @"text": best.text, @"final": @YES, @"lang": best.lang, @"conf": @(best.conf), @"segs": best.segs ?: @[], @"auto": @YES });
    } else if (self.emit) self.emit(@"speechError", @{ @"code": @"no_speech" });
    [self teardown:YES];
}

#pragma mark Timers

- (void)armSilence:(NSTimeInterval)secs {
    [_silence invalidate];
    __weak typeof(self) ws = self;
    _silence = [NSTimer scheduledTimerWithTimeInterval:secs repeats:NO block:^(NSTimer *t) { [ws stop]; }];
}

// continuous: a short pause closes the current segment
- (void)armPause {
    [_silence invalidate];
    __weak typeof(self) ws = self;
    _silence = [NSTimer scheduledTimerWithTimeInterval:1.15 repeats:NO block:^(NSTimer *t) { [ws rotate]; }];
}
- (void)armRotate {
    [_rotateTimer invalidate];
    __weak typeof(self) ws = self;
    _rotateTimer = [NSTimer scheduledTimerWithTimeInterval:50 repeats:YES block:^(NSTimer *t) { [ws rotate]; }];
}

- (void)rotate {
    if (!_engine || _stopping || ![_mode isEqualToString:@"continuous"]) return;
    TJRecSlot *cur = nil;
    for (TJRecSlot *s in _slots) if (!s.done) cur = s;
    if (cur && !cur.text.length) {
        // nothing said in this segment yet; restart only if it is getting old (Apple's ~1 minute limit)
        if (CACurrentMediaTime() - _lastSpeech < 45) { [self armSilence:600]; return; }
    }
    NSString *err = nil;
    TJRecSlot *next = [self makeSlot:_langs.firstObject error:&err];
    if (!next) return;
    [_slots addObject:next];
    self.feed = @[ next.request ];
    [cur.request endAudio];
    [self runSlot:next];
    [self armSilence:600];
}

#pragma mark Stop

- (void)stop {
    if (!_engine || _stopping) return;
    _stopping = YES;
    [_silence invalidate]; _silence = nil;
    [_maxTimer invalidate]; _maxTimer = nil;
    [_rotateTimer invalidate]; _rotateTimer = nil;
    if (_engine.isRunning) [_engine stop];
    if (_tap) { [_engine.inputNode removeTapOnBus:0]; _tap = NO; }
    for (TJRecSlot *s in _slots) [s.request endAudio];
    self.feed = @[];
    NSUInteger session = _session;
    __weak typeof(self) ws = self;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2.6 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        TJSpeech *me = ws; if (!me || me->_session != session || !me->_engine) return;
        if ([me->_mode isEqualToString:@"auto"]) { for (TJRecSlot *s in me->_slots) s.done = YES; [me finishAuto]; }
        else [me teardown:YES];
    });
}

- (void)cancel { [self teardown:YES]; }

- (void)teardown:(BOOL)notify {
    [_silence invalidate]; _silence = nil;
    [_maxTimer invalidate]; _maxTimer = nil;
    [_rotateTimer invalidate]; _rotateTimer = nil;
    BOOL was = _engine != nil;
    if (_engine) {
        if (_engine.isRunning) [_engine stop];
        if (_tap) { [_engine.inputNode removeTapOnBus:0]; _tap = NO; }
    }
    for (TJRecSlot *s in _slots) { [s.request endAudio]; [s.task cancel]; }
    [_slots removeAllObjects];
    self.feed = @[];
    _engine = nil;
    _session++;
    _stopping = NO;
    if (was) {
        if (self.afterStop) self.afterStop();
        if (notify && self.emit) self.emit(@"listenState", @{ @"on": @NO });
    }
}

@end
