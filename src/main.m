// Turjuman (ترجمان) — translator with Merriam-Webster dictionary.
// Native shell: WKWebView UI + networking, speech recognition (speech.m), TTS, audio, storage,
// launch actions (URL scheme / quick actions), notifications, sharing with the keyboard. Media lives in media.m.

#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>
#import <Speech/Speech.h>
#import <AVFoundation/AVFoundation.h>
#import <QuartzCore/QuartzCore.h>
#import <UserNotifications/UserNotifications.h>
#import "tj.h"

static NSString *const kStoreKey = @"tj.store";
static NSString *const kSharedPB = @"com.turjuman.shared";

#pragma mark - Weak script handler (avoids retain cycle)

@interface TJWeakHandler : NSObject <WKScriptMessageHandler>
@property (nonatomic, weak) id<WKScriptMessageHandler> target;
@end
@implementation TJWeakHandler
- (void)userContentController:(WKUserContentController *)c didReceiveScriptMessage:(WKScriptMessage *)m {
    [self.target userContentController:c didReceiveScriptMessage:m];
}
@end

#pragma mark - View controller

@interface TJViewController () <WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate, AVSpeechSynthesizerDelegate>
@property (nonatomic, strong) WKWebView *web;
@property (nonatomic, strong) NSURLSession *session;
@property (nonatomic, strong) AVSpeechSynthesizer *synth;
@property (nonatomic, strong) AVPlayer *player;
@property (nonatomic, strong) UIImpactFeedbackGenerator *haptics;
@property (nonatomic, strong) TJSpeech *speech;
@property (nonatomic, strong) NSMapTable<AVSpeechUtterance *, NSString *> *utterIds;
@property (nonatomic, strong) NSMutableArray<NSDictionary *> *pendingActions;
@property (nonatomic) BOOL jsReady;
@end

@implementation TJViewController

- (UIColor *)paperColor {
    return [UIColor colorWithDynamicProvider:^UIColor *(UITraitCollection *t) {
        if (t.userInterfaceStyle == UIUserInterfaceStyleDark)
            return [UIColor colorWithRed:12/255.0 green:15/255.0 blue:30/255.0 alpha:1];
        return [UIColor colorWithRed:243/255.0 green:245/255.0 blue:250/255.0 alpha:1];
    }];
}

- (instancetype)init {
    if ((self = [super init])) { _pendingActions = [NSMutableArray array]; }
    return self;
}

- (void)viewDidLoad {
    [super viewDidLoad];
    self.view.backgroundColor = [self paperColor];

    NSURLSessionConfiguration *sc = [NSURLSessionConfiguration defaultSessionConfiguration];
    sc.timeoutIntervalForRequest = 30;
    sc.HTTPAdditionalHeaders = @{ @"Accept-Language": @"en-US,en;q=0.9,ar;q=0.8" };
    self.session = [NSURLSession sessionWithConfiguration:sc];

    self.synth = [AVSpeechSynthesizer new];
    self.synth.delegate = self;
    self.utterIds = [NSMapTable weakToStrongObjectsMapTable];
    self.haptics = [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleLight];

    __weak typeof(self) ws = self;
    self.speech = [TJSpeech new];
    self.speech.emit = ^(NSString *name, NSDictionary *data) { [ws emit:name data:data]; };
    self.speech.beforeStart = ^{
        if (ws.synth.isSpeaking) [ws.synth stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
        [ws.player pause];
    };
    self.speech.afterStop = ^{ [ws usePlaybackSession]; };

    WKWebViewConfiguration *cfg = [WKWebViewConfiguration new];
    cfg.allowsInlineMediaPlayback = YES;
    cfg.mediaTypesRequiringUserActionForPlayback = WKAudiovisualMediaTypeNone;

    WKUserContentController *ucc = [WKUserContentController new];
    TJWeakHandler *h = [TJWeakHandler new];
    h.target = self;
    [ucc addScriptMessageHandler:h name:@"tj"];

    NSDictionary *store = [[NSUserDefaults standardUserDefaults] dictionaryForKey:kStoreKey] ?: @{};
    NSData *sd = [NSJSONSerialization dataWithJSONObject:store options:0 error:nil] ?: [@"{}" dataUsingEncoding:NSUTF8StringEncoding];
    NSString *ver = [NSBundle mainBundle].infoDictionary[@"CFBundleShortVersionString"] ?: @"";
    NSString *js = [NSString stringWithFormat:@"window.__TJ_STORE=%@;window.__TJ_NATIVE=true;window.__TJ_VERSION='%@';",
                    [[NSString alloc] initWithData:sd encoding:NSUTF8StringEncoding], ver];
    [ucc addUserScript:[[WKUserScript alloc] initWithSource:js
                                              injectionTime:WKUserScriptInjectionTimeAtDocumentStart
                                           forMainFrameOnly:YES]];
    cfg.userContentController = ucc;

    self.web = [[WKWebView alloc] initWithFrame:self.view.bounds configuration:cfg];
    self.web.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    self.web.opaque = NO;
    self.web.backgroundColor = [UIColor clearColor];
    self.web.scrollView.backgroundColor = [UIColor clearColor];
    self.web.scrollView.bounces = NO;
    self.web.scrollView.contentInsetAdjustmentBehavior = UIScrollViewContentInsetAdjustmentNever;
    self.web.allowsLinkPreview = NO;
    self.web.navigationDelegate = self;
    self.web.UIDelegate = self;
    if ([self.web respondsToSelector:NSSelectorFromString(@"setInspectable:")]) {
        [self.web setValue:@YES forKey:@"inspectable"];
    }
    [self.view addSubview:self.web];

    NSURL *dir = [[NSBundle mainBundle] URLForResource:@"web" withExtension:nil];
    NSURL *index = [dir URLByAppendingPathComponent:@"index.html"];
    [self.web loadFileURL:index allowingReadAccessToURL:dir];

    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(appWillResign)
                                                 name:UIApplicationWillResignActiveNotification object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(appDidBecomeActive)
                                                 name:UIApplicationDidBecomeActiveNotification object:nil];
}

- (void)appDidBecomeActive { [self emit:@"appActive" data:@{}]; }

- (void)appWillResign {
    // continuous listening keeps going only while the app is in front
    if (self.speech.listening) [self.speech cancel];
}

#pragma mark Launch actions (URL scheme, quick actions)

- (void)handleLaunchAction:(NSDictionary *)action {
    if (!action) return;
    if (self.jsReady) [self emit:@"action" data:action];
    else [self.pendingActions addObject:action];
}

#pragma mark JS plumbing

- (NSString *)json:(id)obj {
    NSData *d = [NSJSONSerialization dataWithJSONObject:obj options:0 error:nil];
    return d ? [[NSString alloc] initWithData:d encoding:NSUTF8StringEncoding] : @"{}";
}

- (void)runJS:(NSString *)js {
    if (![NSThread isMainThread]) {
        dispatch_async(dispatch_get_main_queue(), ^{ [self runJS:js]; });
        return;
    }
    [self.web evaluateJavaScript:js completionHandler:nil];
}

- (void)emit:(NSString *)name data:(NSDictionary *)data {
    [self runJS:[NSString stringWithFormat:@"window.TJ&&TJ._event('%@',%@)", name, [self json:data ?: @{}]]];
}

- (void)resolve:(NSNumber *)rid ok:(BOOL)ok data:(id)data code:(NSString *)code msg:(NSString *)msg {
    NSMutableDictionary *p = [NSMutableDictionary dictionary];
    p[@"ok"] = @(ok);
    if (data) p[@"data"] = data;
    if (code) p[@"code"] = code;
    if (msg) p[@"error"] = msg;
    [self runJS:[NSString stringWithFormat:@"window.TJ&&TJ._resolve(%ld,%@)", (long)rid.integerValue, [self json:p]]];
}

static NSString *TJStr(NSDictionary *a, NSString *k, NSString *def) { return [a[k] isKindOfClass:[NSString class]] ? a[k] : def; }

- (void)userContentController:(WKUserContentController *)c didReceiveScriptMessage:(WKScriptMessage *)m {
    if (![m.body isKindOfClass:[NSDictionary class]]) return;
    NSDictionary *b = m.body;
    NSNumber *rid = [b[@"id"] isKindOfClass:[NSNumber class]] ? b[@"id"] : @0;
    NSString *cmd = TJStr(b, @"cmd", @"");
    NSDictionary *a = [b[@"args"] isKindOfClass:[NSDictionary class]] ? b[@"args"] : @{};

    __weak typeof(self) ws = self;
    TJOk ok = ^(id data) { [ws resolve:rid ok:YES data:data ?: @{} code:nil msg:nil]; };
    TJFail fail = ^(NSString *code, NSString *msg) { [ws resolve:rid ok:NO data:nil code:code msg:msg]; };

    if ([cmd isEqualToString:@"http"]) [self http:a ok:ok fail:fail];
    else if ([cmd isEqualToString:@"set"]) { [self storeSet:a]; ok(@{}); }
    else if ([cmd isEqualToString:@"ready"]) {
        self.jsReady = YES;
        for (NSDictionary *act in self.pendingActions) [self emit:@"action" data:act];
        [self.pendingActions removeAllObjects];
        ok(@{});
    }
    else if ([cmd isEqualToString:@"speak"]) [self speak:a ok:ok fail:fail];
    else if ([cmd isEqualToString:@"stopSpeak"]) {
        if (self.synth.isSpeaking) [self.synth stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
        [self.player pause];
        ok(@{});
    }
    else if ([cmd isEqualToString:@"play"]) [self play:a ok:ok fail:fail];
    else if ([cmd isEqualToString:@"listen"]) {
        [self.speech startWithOptions:a completion:^(NSString *err) { if (err) fail(err, nil); else ok(@{}); }];
    }
    else if ([cmd isEqualToString:@"stopListen"]) { [self.speech stop]; ok(@{}); }
    else if ([cmd isEqualToString:@"cancelListen"]) { [self.speech cancel]; ok(@{}); }
    else if ([cmd isEqualToString:@"copy"]) {
        [UIPasteboard generalPasteboard].string = TJStr(a, @"text", @"");
        ok(@{});
    }
    else if ([cmd isEqualToString:@"paste"]) ok(@{ @"text": [UIPasteboard generalPasteboard].string ?: @"" });
    else if ([cmd isEqualToString:@"clipboardInfo"]) {
        UIPasteboard *pb = [UIPasteboard generalPasteboard];
        ok(@{ @"has": @(pb.hasStrings), @"image": @(!pb.hasStrings && pb.hasImages), @"count": @(pb.changeCount) });
    }
    else if ([cmd isEqualToString:@"openURL"]) {
        NSURL *u = [NSURL URLWithString:TJStr(a, @"url", @"")];
        if (u) [[UIApplication sharedApplication] openURL:u options:@{} completionHandler:nil];
        ok(@{});
    }
    else if ([cmd isEqualToString:@"haptic"]) {
        NSString *style = TJStr(a, @"style", @"light");
        if ([style isEqualToString:@"success"]) [[UINotificationFeedbackGenerator new] notificationOccurred:UINotificationFeedbackTypeSuccess];
        else if ([style isEqualToString:@"error"]) [[UINotificationFeedbackGenerator new] notificationOccurred:UINotificationFeedbackTypeError];
        else [self.haptics impactOccurred];
        ok(@{});
    }
    else if ([cmd isEqualToString:@"keepAwake"]) { [UIApplication sharedApplication].idleTimerDisabled = [a[@"on"] boolValue]; ok(@{}); }
    else if ([cmd isEqualToString:@"openSettings"]) {
        [[UIApplication sharedApplication] openURL:[NSURL URLWithString:UIApplicationOpenSettingsURLString] options:@{} completionHandler:nil];
        ok(@{});
    }
    else if ([cmd isEqualToString:@"keyboardStatus"]) {
        id kbs = [[NSUserDefaults standardUserDefaults] objectForKey:@"AppleKeyboards"];
        NSString *mine = [NSBundle mainBundle].bundleIdentifier ?: @"";
        BOOL enabled = NO;
        if ([kbs isKindOfClass:[NSArray class]]) {
            for (id k in kbs) if ([k isKindOfClass:[NSString class]] && [k hasPrefix:mine] && ![k isEqualToString:mine]) enabled = YES;
        }
        ok(@{ @"enabled": @(enabled), @"known": @([kbs isKindOfClass:[NSArray class]]) });
    }
    else if ([cmd isEqualToString:@"sharedSet"]) {
        UIPasteboard *pb = [UIPasteboard pasteboardWithName:kSharedPB create:YES];
        [pb setString:TJStr(a, @"json", @"{}")];
        ok(@{});
    }
    else if ([cmd isEqualToString:@"voices"]) {
        NSString *lang = TJStr(a, @"lang", @"en-US");
        NSMutableArray *list = [NSMutableArray array];
        for (AVSpeechSynthesisVoice *v in [self voicesFor:lang]) {
            [list addObject:@{ @"id": v.identifier ?: @"", @"name": v.name ?: @"", @"quality": @((NSInteger)v.quality), @"gender": @((NSInteger)v.gender) }];
        }
        ok(@{ @"voices": list });
    }
    else if ([cmd isEqualToString:@"audioRoute"]) {
        AVAudioSessionRouteDescription *r = [AVAudioSession sharedInstance].currentRoute;
        NSString *name = @""; BOOL bt = NO;
        for (AVAudioSessionPortDescription *p in r.outputs) {
            name = p.portName ?: @"";
            if ([p.portType isEqualToString:AVAudioSessionPortBluetoothA2DP] || [p.portType isEqualToString:AVAudioSessionPortBluetoothHFP] || [p.portType isEqualToString:AVAudioSessionPortBluetoothLE]) bt = YES;
        }
        ok(@{ @"bt": @(bt), @"name": name });
    }
    else if ([cmd isEqualToString:@"appVersion"]) {
        NSDictionary *inf = [NSBundle mainBundle].infoDictionary;
        ok(@{ @"version": inf[@"CFBundleShortVersionString"] ?: @"", @"build": inf[@"CFBundleVersion"] ?: @"" });
    }
    else if ([cmd isEqualToString:@"notify"]) [self notify:a ok:ok fail:fail];
    else if (![self handleMediaCommand:cmd args:a ok:ok fail:fail]) fail(@"unknown_cmd", cmd);
}

#pragma mark Storage

- (void)storeSet:(NSDictionary *)a {
    NSString *key = TJStr(a, @"key", nil);
    if (!key) return;
    NSUserDefaults *ud = [NSUserDefaults standardUserDefaults];
    NSMutableDictionary *store = [[ud dictionaryForKey:kStoreKey] mutableCopy] ?: [NSMutableDictionary dictionary];
    id v = a[@"value"];
    if ([v isKindOfClass:[NSString class]]) store[key] = v; else [store removeObjectForKey:key];
    [ud setObject:store forKey:kStoreKey];
}

#pragma mark Networking (no CORS limits)

- (void)http:(NSDictionary *)a ok:(TJOk)ok fail:(TJFail)fail {
    NSString *us = TJStr(a, @"url", @"");
    NSURL *url = [NSURL URLWithString:us];
    if (!url || !([url.scheme isEqualToString:@"https"] || [url.scheme isEqualToString:@"http"])) { fail(@"bad_url", us); return; }
    double timeout = [a[@"timeout"] isKindOfClass:[NSNumber class]] ? [a[@"timeout"] doubleValue] : 25;
    NSMutableURLRequest *r = [NSMutableURLRequest requestWithURL:url
                                                     cachePolicy:NSURLRequestUseProtocolCachePolicy
                                                 timeoutInterval:timeout > 0 ? timeout : 25];
    r.HTTPMethod = TJStr(a, @"method", @"GET");
    NSDictionary *hdr = [a[@"headers"] isKindOfClass:[NSDictionary class]] ? a[@"headers"] : @{};
    for (NSString *k in hdr) {
        id v = hdr[k];
        if ([k isKindOfClass:[NSString class]] && [v isKindOfClass:[NSString class]]) [r setValue:v forHTTPHeaderField:k];
    }
    if ([a[@"body"] isKindOfClass:[NSString class]]) r.HTTPBody = [a[@"body"] dataUsingEncoding:NSUTF8StringEncoding];

    [[self.session dataTaskWithRequest:r completionHandler:^(NSData *data, NSURLResponse *resp, NSError *error) {
        dispatch_async(dispatch_get_main_queue(), ^{
            if (error) {
                NSString *code = @"net";
                if (error.code == NSURLErrorNotConnectedToInternet || error.code == NSURLErrorNetworkConnectionLost) code = @"offline";
                else if (error.code == NSURLErrorTimedOut) code = @"timeout";
                fail(code, error.localizedDescription);
                return;
            }
            NSInteger status = [resp isKindOfClass:[NSHTTPURLResponse class]] ? ((NSHTTPURLResponse *)resp).statusCode : 0;
            NSString *body = @"";
            if (data.length) {
                body = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding]
                    ?: [[NSString alloc] initWithData:data encoding:NSISOLatin1StringEncoding] ?: @"";
            }
            ok(@{ @"status": @(status), @"body": body });
        });
    }] resume];
}

#pragma mark Audio session

- (void)usePlaybackSession {
    AVAudioSession *s = [AVAudioSession sharedInstance];
    [s setCategory:AVAudioSessionCategoryPlayback mode:AVAudioSessionModeSpokenAudio
           options:AVAudioSessionCategoryOptionDuckOthers error:nil];
    [s setActive:YES error:nil];
}

#pragma mark Text to speech

- (BOOL)isNoveltyVoice:(AVSpeechSynthesisVoice *)v {
    NSString *ident = v.identifier ?: @"";
    return [ident containsString:@"speech.synthesis.voice"] || [ident containsString:@"eloquence"];
}

// Voices for one exact locale (e.g. en-US = American only), best quality first.
- (NSArray<AVSpeechSynthesisVoice *> *)voicesFor:(NSString *)lang {
    NSMutableArray *out = [NSMutableArray array];
    for (AVSpeechSynthesisVoice *v in [AVSpeechSynthesisVoice speechVoices]) {
        if ([v.language isEqualToString:lang] && ![self isNoveltyVoice:v]) [out addObject:v];
    }
    [out sortUsingComparator:^NSComparisonResult(AVSpeechSynthesisVoice *a, AVSpeechSynthesisVoice *b) {
        if (a.quality != b.quality) return a.quality > b.quality ? NSOrderedAscending : NSOrderedDescending;
        return [a.name compare:b.name];
    }];
    return out;
}

- (AVSpeechSynthesisVoice *)voiceFor:(NSString *)lang preferred:(NSString *)voiceId {
    if (voiceId.length) {
        AVSpeechSynthesisVoice *v = [AVSpeechSynthesisVoice voiceWithIdentifier:voiceId];
        if (v && [v.language isEqualToString:lang]) return v;
    }
    AVSpeechSynthesisVoice *def = [AVSpeechSynthesisVoice voiceWithLanguage:lang];
    AVSpeechSynthesisVoice *best = [[self voicesFor:lang] firstObject];
    if (best && (!def || best.quality > def.quality)) return best;
    if (def && ![def.language hasPrefix:[[lang componentsSeparatedByString:@"-"] firstObject]]) return best;
    return def ?: best;
}

- (void)speak:(NSDictionary *)a ok:(TJOk)ok fail:(TJFail)fail {
    NSString *text = TJStr(a, @"text", @"");
    NSString *lang = TJStr(a, @"lang", @"en-US");
    double rate = [a[@"rate"] isKindOfClass:[NSNumber class]] ? [a[@"rate"] doubleValue] : 1.0;
    if (!text.length) { ok(@{}); return; }
    if (self.speech.listening) { fail(@"busy", @"listening"); return; }
    AVSpeechSynthesisVoice *voice = [self voiceFor:lang preferred:TJStr(a, @"voice", nil)];
    if (!voice) { fail(@"no_voice", lang); return; }
    [self.player pause];
    [self usePlaybackSession];
    if (self.synth.isSpeaking && ![a[@"queue"] boolValue]) [self.synth stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
    AVSpeechUtterance *u = [AVSpeechUtterance speechUtteranceWithString:text];
    u.voice = voice;
    float r = AVSpeechUtteranceDefaultSpeechRate * (float)(rate > 0 ? rate : 1.0);
    u.rate = MAX(AVSpeechUtteranceMinimumSpeechRate, MIN(AVSpeechUtteranceMaximumSpeechRate, r));
    if ([a[@"pitch"] isKindOfClass:[NSNumber class]]) u.pitchMultiplier = [a[@"pitch"] floatValue];
    NSString *uid = TJStr(a, @"id", nil);
    if (uid) [self.utterIds setObject:uid forKey:u];
    [self.synth speakUtterance:u];
    ok(@{});
}

- (void)speechSynthesizer:(AVSpeechSynthesizer *)s didStartSpeechUtterance:(AVSpeechUtterance *)u {
    [self emit:@"tts" data:@{ @"speaking": @YES }];
}
- (void)speechSynthesizer:(AVSpeechSynthesizer *)s didFinishSpeechUtterance:(AVSpeechUtterance *)u {
    NSString *uid = [self.utterIds objectForKey:u];
    if (uid) { [self emit:@"ttsDone" data:@{ @"id": uid, @"done": @YES }]; [self.utterIds removeObjectForKey:u]; }
    if (!s.isSpeaking) [self emit:@"tts" data:@{ @"speaking": @NO }];
}
- (void)speechSynthesizer:(AVSpeechSynthesizer *)s didCancelSpeechUtterance:(AVSpeechUtterance *)u {
    NSString *uid = [self.utterIds objectForKey:u];
    if (uid) { [self emit:@"ttsDone" data:@{ @"id": uid, @"done": @NO }]; [self.utterIds removeObjectForKey:u]; }
    if (!s.isSpeaking) [self emit:@"tts" data:@{ @"speaking": @NO }];
}

#pragma mark Audio from the web (dictionary pronunciations)

- (void)play:(NSDictionary *)a ok:(TJOk)ok fail:(TJFail)fail {
    NSURL *u = [NSURL URLWithString:TJStr(a, @"url", @"")];
    if (!u) { fail(@"bad_url", nil); return; }
    if (self.speech.listening) { fail(@"busy", @"listening"); return; }
    if (self.synth.isSpeaking) [self.synth stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
    [self usePlaybackSession];
    self.player = [AVPlayer playerWithURL:u];
    [self.player play];
    ok(@{});
}

#pragma mark Local notifications

- (void)notify:(NSDictionary *)a ok:(TJOk)ok fail:(TJFail)fail {
    UNUserNotificationCenter *nc = [UNUserNotificationCenter currentNotificationCenter];
    NSString *action = TJStr(a, @"action", @"schedule");
    NSString *ident = TJStr(a, @"id", @"tj.daily");
    if ([action isEqualToString:@"cancel"]) {
        NSArray *ids = [a[@"ids"] isKindOfClass:[NSArray class]] ? a[@"ids"] : @[ ident ];
        [nc removePendingNotificationRequestsWithIdentifiers:ids];
        ok(@{}); return;
    }
    if ([action isEqualToString:@"status"]) {
        [nc getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *st) {
            dispatch_async(dispatch_get_main_queue(), ^{ ok(@{ @"status": @(st.authorizationStatus) }); });
        }];
        return;
    }
    [nc requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge)
                      completionHandler:^(BOOL granted, NSError *error) {
        dispatch_async(dispatch_get_main_queue(), ^{
            if (!granted) { fail(@"notif_denied", nil); return; }
            if ([action isEqualToString:@"request"]) { ok(@{ @"granted": @YES }); return; }
            UNMutableNotificationContent *c = [UNMutableNotificationContent new];
            c.title = TJStr(a, @"title", @"ترجمان");
            c.body = TJStr(a, @"body", @"");
            c.sound = [UNNotificationSound defaultSound];
            c.userInfo = @{ @"open": TJStr(a, @"open", @"") };
            NSDateComponents *dc = [NSDateComponents new];
            dc.hour = [a[@"hour"] integerValue];
            dc.minute = [a[@"minute"] integerValue];
            BOOL once = a[@"day"] != nil;
            if (once) { dc.year = [a[@"year"] integerValue]; dc.month = [a[@"month"] integerValue]; dc.day = [a[@"day"] integerValue]; }
            UNCalendarNotificationTrigger *tr = [UNCalendarNotificationTrigger triggerWithDateMatchingComponents:dc repeats:!once];
            UNNotificationRequest *req = [UNNotificationRequest requestWithIdentifier:ident content:c trigger:tr];
            [nc addNotificationRequest:req withCompletionHandler:^(NSError *e) {
                dispatch_async(dispatch_get_main_queue(), ^{ if (e) fail(@"notif_failed", e.localizedDescription); else ok(@{}); });
            }];
        });
    }];
}

#pragma mark Navigation / UI delegate

- (void)webView:(WKWebView *)webView decidePolicyForNavigationAction:(WKNavigationAction *)action
    decisionHandler:(void (^)(WKNavigationActionPolicy))decisionHandler {
    NSURL *u = action.request.URL;
    NSString *scheme = u.scheme.lowercaseString ?: @"";
    if ([scheme isEqualToString:@"file"] || [scheme isEqualToString:@"about"] || [scheme isEqualToString:@"blob"] || [scheme isEqualToString:@"data"]) {
        decisionHandler(WKNavigationActionPolicyAllow);
        return;
    }
    if ([scheme isEqualToString:@"http"] || [scheme isEqualToString:@"https"] || [scheme isEqualToString:@"mailto"]) {
        [[UIApplication sharedApplication] openURL:u options:@{} completionHandler:nil];
    }
    decisionHandler(WKNavigationActionPolicyCancel);
}

- (WKWebView *)webView:(WKWebView *)webView createWebViewWithConfiguration:(WKWebViewConfiguration *)configuration
   forNavigationAction:(WKNavigationAction *)action windowFeatures:(WKWindowFeatures *)windowFeatures {
    NSURL *u = action.request.URL;
    if (u) [[UIApplication sharedApplication] openURL:u options:@{} completionHandler:nil];
    return nil;
}

- (void)webView:(WKWebView *)webView runJavaScriptAlertPanelWithMessage:(NSString *)message
    initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(void))completionHandler {
    UIAlertController *ac = [UIAlertController alertControllerWithTitle:nil message:message preferredStyle:UIAlertControllerStyleAlert];
    [ac addAction:[UIAlertAction actionWithTitle:@"حسنًا" style:UIAlertActionStyleDefault handler:^(UIAlertAction *x) { completionHandler(); }]];
    [self presentViewController:ac animated:YES completion:nil];
}

- (void)webView:(WKWebView *)webView runJavaScriptConfirmPanelWithMessage:(NSString *)message
    initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(BOOL))completionHandler {
    UIAlertController *ac = [UIAlertController alertControllerWithTitle:nil message:message preferredStyle:UIAlertControllerStyleAlert];
    [ac addAction:[UIAlertAction actionWithTitle:@"إلغاء" style:UIAlertActionStyleCancel handler:^(UIAlertAction *x) { completionHandler(NO); }]];
    [ac addAction:[UIAlertAction actionWithTitle:@"موافق" style:UIAlertActionStyleDefault handler:^(UIAlertAction *x) { completionHandler(YES); }]];
    [self presentViewController:ac animated:YES completion:nil];
}

- (void)webViewWebContentProcessDidTerminate:(WKWebView *)webView {
    self.jsReady = NO;
    [webView reload];
}

@end

#pragma mark - App delegate

@interface TJAppDelegate : UIResponder <UIApplicationDelegate, UNUserNotificationCenterDelegate>
@property (nonatomic, strong) UIWindow *window;
@property (nonatomic, strong) TJViewController *vc;
@end

@implementation TJAppDelegate
- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
    self.vc = [TJViewController new];
    self.window.rootViewController = self.vc;
    [self.window makeKeyAndVisible];
    [UNUserNotificationCenter currentNotificationCenter].delegate = self;
    UIApplicationShortcutItem *item = launchOptions[UIApplicationLaunchOptionsShortcutItemKey];
    if (item) { [self.vc handleLaunchAction:@{ @"type": item.type ?: @"" }]; return NO; }
    return YES;
}

- (BOOL)application:(UIApplication *)app openURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options {
    [self.vc handleLaunchAction:@{ @"type": @"url", @"url": url.absoluteString ?: @"" }];
    return YES;
}

- (void)application:(UIApplication *)application performActionForShortcutItem:(UIApplicationShortcutItem *)shortcutItem
  completionHandler:(void (^)(BOOL))completionHandler {
    [self.vc handleLaunchAction:@{ @"type": shortcutItem.type ?: @"" }];
    completionHandler(YES);
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completionHandler {
    NSString *open = response.notification.request.content.userInfo[@"open"];
    if ([open isKindOfClass:[NSString class]] && open.length) [self.vc handleLaunchAction:@{ @"type": open }];
    completionHandler();
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler {
    completionHandler(UNNotificationPresentationOptionBanner | UNNotificationPresentationOptionSound);
}
@end

int main(int argc, char *argv[]) {
    @autoreleasepool {
        return UIApplicationMain(argc, argv, nil, NSStringFromClass([TJAppDelegate class]));
    }
}
