// Turjuman media: camera live-translate, OCR (Vision), photo/file pickers, audio/video transcription,
// PDF/Word/text documents, PDF export, share sheet, voice recorder.
#import <UIKit/UIKit.h>
#import <AVFoundation/AVFoundation.h>
#import <Vision/Vision.h>
#import <Speech/Speech.h>
#import <PDFKit/PDFKit.h>
#import <PhotosUI/PhotosUI.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <WebKit/WebKit.h>
#import "tj.h"

static NSString *TJS(NSDictionary *a, NSString *k, NSString *def) { return [a[k] isKindOfClass:[NSString class]] ? a[k] : def; }

#pragma mark - Image helpers

static UIImage *TJUpright(UIImage *img, CGFloat maxSide) {
    CGSize s = img.size;
    CGFloat scale = MIN(1.0, maxSide / MAX(s.width, s.height));
    CGSize ns = CGSizeMake(floor(s.width * scale), floor(s.height * scale));
    UIGraphicsImageRendererFormat *f = [UIGraphicsImageRendererFormat defaultFormat];
    f.scale = 1;
    UIGraphicsImageRenderer *r = [[UIGraphicsImageRenderer alloc] initWithSize:ns format:f];
    return [r imageWithActions:^(UIGraphicsImageRendererContext *ctx) { [img drawInRect:CGRectMake(0, 0, ns.width, ns.height)]; }];
}

static NSString *TJDataURL(UIImage *img, CGFloat q) {
    NSData *d = UIImageJPEGRepresentation(img, q);
    return [@"data:image/jpeg;base64," stringByAppendingString:[d base64EncodedStringWithOptions:0]];
}

static UIImage *TJImageFromDataURL(NSString *s) {
    NSRange r = [s rangeOfString:@","];
    NSString *b64 = r.location == NSNotFound ? s : [s substringFromIndex:r.location + 1];
    NSData *d = [[NSData alloc] initWithBase64EncodedString:b64 options:NSDataBase64DecodingIgnoreUnknownCharacters];
    return d ? [UIImage imageWithData:d] : nil;
}

static NSArray<NSString *> *TJOCRLanguages(VNRecognizeTextRequest *req, BOOL preferArabic) {
    NSArray *sup = nil;
    sup = [req supportedRecognitionLanguagesAndReturnError:nil];
    NSMutableArray *out = [NSMutableArray array];
    NSArray *want = preferArabic ? @[ @"ar-SA", @"ars-SA", @"en-US" ] : @[ @"en-US", @"ar-SA", @"ars-SA" ];
    for (NSString *l in want) if ([sup containsObject:l]) [out addObject:l];
    for (NSString *l in @[ @"fr-FR", @"es-ES", @"de-DE", @"tr-TR" ]) if ([sup containsObject:l] && out.count < 4) [out addObject:l];
    if (!out.count) [out addObject:@"en-US"];
    return out;
}

static BOOL TJOCRSupportsArabic(void) {
    VNRecognizeTextRequest *req = [VNRecognizeTextRequest new];
    NSArray *sup = nil;
    sup = [req supportedRecognitionLanguagesAndReturnError:nil];
    return [sup containsObject:@"ar-SA"] || [sup containsObject:@"ars-SA"];
}

// Recognize text lines in an upright image. Boxes are normalized with a top-left origin.
static void TJRecognize(UIImage *img, BOOL preferArabic, VNRequestTextRecognitionLevel level, void (^done)(NSArray *blocks)) {
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        VNRecognizeTextRequest *req = [[VNRecognizeTextRequest alloc] init];
        req.recognitionLevel = level;
        req.usesLanguageCorrection = YES;
        req.recognitionLanguages = TJOCRLanguages(req, preferArabic);
        if ([req respondsToSelector:NSSelectorFromString(@"setAutomaticallyDetectsLanguage:")]) [req setValue:@YES forKey:@"automaticallyDetectsLanguage"];
        VNImageRequestHandler *h = [[VNImageRequestHandler alloc] initWithCGImage:img.CGImage options:@{}];
        NSError *e = nil;
        [h performRequests:@[ req ] error:&e];
        NSMutableArray *blocks = [NSMutableArray array];
        for (VNRecognizedTextObservation *o in req.results ?: @[]) {
            VNRecognizedText *t = [[o topCandidates:1] firstObject];
            if (!t.string.length) continue;
            CGRect b = o.boundingBox;
            [blocks addObject:@{ @"text": t.string, @"conf": @(t.confidence),
                                 @"x": @(b.origin.x), @"y": @(1.0 - b.origin.y - b.size.height), @"w": @(b.size.width), @"h": @(b.size.height) }];
        }
        dispatch_async(dispatch_get_main_queue(), ^{ done(blocks); });
    });
}

#pragma mark - Camera with live translation

@interface TJCameraVC : UIViewController <AVCaptureVideoDataOutputSampleBufferDelegate, AVCapturePhotoCaptureDelegate>
@property (nonatomic, copy) NSString *tl;
@property (nonatomic, copy) void (^done)(UIImage *photo);
@end

@implementation TJCameraVC {
    AVCaptureSession *_session;
    AVCaptureVideoPreviewLayer *_preview;
    AVCapturePhotoOutput *_photo;
    AVCaptureVideoDataOutput *_video;
    AVCaptureDevice *_device;
    dispatch_queue_t _q;
    UIView *_overlay;
    UIButton *_liveBtn, *_shutter, *_torch, *_close;
    UILabel *_hint;
    BOOL _live, _busy, _finished;
    CFTimeInterval _lastOCR;
    NSMutableDictionary<NSString *, NSString *> *_cache;
    NSURLSession *_net;
}

- (void)viewDidLoad {
    [super viewDidLoad];
    self.view.backgroundColor = UIColor.blackColor;
    _q = dispatch_queue_create("tj.camera", DISPATCH_QUEUE_SERIAL);
    _cache = [NSMutableDictionary dictionary];
    _net = [NSURLSession sessionWithConfiguration:[NSURLSessionConfiguration ephemeralSessionConfiguration]];
    _live = YES;

    _session = [AVCaptureSession new];
    _session.sessionPreset = AVCaptureSessionPresetPhoto;
    _device = [AVCaptureDevice defaultDeviceWithMediaType:AVMediaTypeVideo];
    NSError *e = nil;
    AVCaptureDeviceInput *in = _device ? [AVCaptureDeviceInput deviceInputWithDevice:_device error:&e] : nil;
    if (in && [_session canAddInput:in]) [_session addInput:in];
    _photo = [AVCapturePhotoOutput new];
    if ([_session canAddOutput:_photo]) [_session addOutput:_photo];
    _video = [AVCaptureVideoDataOutput new];
    _video.alwaysDiscardsLateVideoFrames = YES;
    _video.videoSettings = @{ (id)kCVPixelBufferPixelFormatTypeKey: @(kCVPixelFormatType_32BGRA) };
    [_video setSampleBufferDelegate:self queue:_q];
    if ([_session canAddOutput:_video]) [_session addOutput:_video];
    AVCaptureConnection *vc = [_video connectionWithMediaType:AVMediaTypeVideo];
    if (vc.isVideoOrientationSupported) vc.videoOrientation = AVCaptureVideoOrientationPortrait;

    _preview = [AVCaptureVideoPreviewLayer layerWithSession:_session];
    _preview.videoGravity = AVLayerVideoGravityResizeAspectFill;
    [self.view.layer addSublayer:_preview];
    _overlay = [UIView new];
    _overlay.userInteractionEnabled = NO;
    [self.view addSubview:_overlay];

    _close = [self roundButton:@"xmark" action:@selector(closeTapped)];
    _torch = [self roundButton:@"flashlight.off.fill" action:@selector(torchTapped)];
    _shutter = [UIButton buttonWithType:UIButtonTypeCustom];
    _shutter.backgroundColor = UIColor.whiteColor;
    _shutter.layer.cornerRadius = 36;
    _shutter.layer.borderWidth = 5;
    _shutter.layer.borderColor = [UIColor colorWithWhite:1 alpha:0.45].CGColor;
    [_shutter addTarget:self action:@selector(shutterTapped) forControlEvents:UIControlEventTouchUpInside];
    _shutter.accessibilityLabel = @"التقط وترجم";
    [self.view addSubview:_shutter];
    _liveBtn = [UIButton buttonWithType:UIButtonTypeSystem];
    _liveBtn.titleLabel.font = [UIFont systemFontOfSize:15 weight:UIFontWeightSemibold];
    _liveBtn.layer.cornerRadius = 17;
    _liveBtn.contentEdgeInsets = UIEdgeInsetsMake(0, 14, 0, 14);
    [_liveBtn addTarget:self action:@selector(liveTapped) forControlEvents:UIControlEventTouchUpInside];
    [self.view addSubview:_liveBtn];
    _hint = [UILabel new];
    _hint.textColor = UIColor.whiteColor;
    _hint.font = [UIFont systemFontOfSize:14 weight:UIFontWeightMedium];
    _hint.textAlignment = NSTextAlignmentCenter;
    _hint.numberOfLines = 2;
    _hint.text = @"وجّه الكاميرا على الكلام. الترجمة تطلع فوقه مباشرة، أو اضغط الزر الأبيض للتفاصيل";
    [self.view addSubview:_hint];
    [self updateLiveBtn];

    dispatch_async(_q, ^{ [self->_session startRunning]; });
}

- (UIButton *)roundButton:(NSString *)sym action:(SEL)sel {
    UIButton *b = [UIButton buttonWithType:UIButtonTypeSystem];
    [b setImage:[UIImage systemImageNamed:sym withConfiguration:[UIImageSymbolConfiguration configurationWithPointSize:18 weight:UIImageSymbolWeightSemibold]] forState:UIControlStateNormal];
    b.tintColor = UIColor.whiteColor;
    b.backgroundColor = [UIColor colorWithWhite:0 alpha:0.45];
    b.layer.cornerRadius = 22;
    [b addTarget:self action:sel forControlEvents:UIControlEventTouchUpInside];
    [self.view addSubview:b];
    return b;
}

- (void)viewDidLayoutSubviews {
    [super viewDidLayoutSubviews];
    CGRect b = self.view.bounds;
    UIEdgeInsets sa = self.view.safeAreaInsets;
    _preview.frame = b;
    _overlay.frame = b;
    _close.frame = CGRectMake(16, sa.top + 8, 44, 44);
    _torch.frame = CGRectMake(b.size.width - 60, sa.top + 8, 44, 44);
    _shutter.frame = CGRectMake((b.size.width - 72) / 2, b.size.height - sa.bottom - 96, 72, 72);
    [_liveBtn sizeToFit];
    CGFloat lw = _liveBtn.bounds.size.width + 8;
    _liveBtn.frame = CGRectMake(b.size.width - lw - 20, CGRectGetMidY(_shutter.frame) - 17, lw, 34);
    _hint.frame = CGRectMake(24, CGRectGetMinY(_shutter.frame) - 56, b.size.width - 48, 44);
}

- (BOOL)prefersStatusBarHidden { return YES; }

- (void)updateLiveBtn {
    [_liveBtn setTitle:_live ? @"مباشر: يعمل" : @"مباشر: متوقف" forState:UIControlStateNormal];
    _liveBtn.backgroundColor = _live ? [UIColor colorWithRed:0.56 green:0.65 blue:1 alpha:0.95] : [UIColor colorWithWhite:0 alpha:0.5];
    [_liveBtn setTitleColor:_live ? [UIColor colorWithRed:0.05 green:0.06 blue:0.12 alpha:1] : UIColor.whiteColor forState:UIControlStateNormal];
    if (!_live) for (UIView *v in _overlay.subviews.copy) [v removeFromSuperview];
    [self.view setNeedsLayout];
}

- (void)liveTapped { _live = !_live; [self updateLiveBtn]; }

- (void)torchTapped {
    if (!_device.hasTorch) return;
    [_device lockForConfiguration:nil];
    BOOL on = _device.torchMode != AVCaptureTorchModeOn;
    _device.torchMode = on ? AVCaptureTorchModeOn : AVCaptureTorchModeOff;
    [_device unlockForConfiguration];
    [_torch setImage:[UIImage systemImageNamed:on ? @"flashlight.on.fill" : @"flashlight.off.fill"] forState:UIControlStateNormal];
}

- (void)finishWith:(UIImage *)img {
    if (_finished) return;
    _finished = YES;
    dispatch_async(_q, ^{ [self->_session stopRunning]; });
    void (^cb)(UIImage *) = self.done;
    [self dismissViewControllerAnimated:YES completion:^{ if (cb) cb(img); }];
}

- (void)closeTapped { [self finishWith:nil]; }

- (void)shutterTapped {
    AVCapturePhotoSettings *s = [AVCapturePhotoSettings photoSettings];
    [_photo capturePhotoWithSettings:s delegate:self];
}

- (void)captureOutput:(AVCapturePhotoOutput *)output didFinishProcessingPhoto:(AVCapturePhoto *)photo error:(NSError *)error {
    NSData *d = photo.fileDataRepresentation;
    UIImage *img = d ? [UIImage imageWithData:d] : nil;
    dispatch_async(dispatch_get_main_queue(), ^{ [self finishWith:img]; });
}

// Live OCR on video frames (portrait buffer), ~1 per second.
- (void)captureOutput:(AVCaptureOutput *)output didOutputSampleBuffer:(CMSampleBufferRef)sampleBuffer fromConnection:(AVCaptureConnection *)connection {
    if (!_live || _busy || _finished) return;
    CFTimeInterval now = CACurrentMediaTime();
    if (now - _lastOCR < 1.0) return;
    _lastOCR = now;
    _busy = YES;
    CVPixelBufferRef pb = CMSampleBufferGetImageBuffer(sampleBuffer);
    if (!pb) { _busy = NO; return; }
    size_t bw = CVPixelBufferGetWidth(pb), bh = CVPixelBufferGetHeight(pb);
    VNRecognizeTextRequest *req = [[VNRecognizeTextRequest alloc] init];
    BOOL wantArabic = ![self.tl isEqualToString:@"ar"];
    req.recognitionLevel = VNRequestTextRecognitionLevelAccurate;
    req.usesLanguageCorrection = YES;
    req.recognitionLanguages = TJOCRLanguages(req, wantArabic);
    VNImageRequestHandler *h = [[VNImageRequestHandler alloc] initWithCVPixelBuffer:pb options:@{}];
    [h performRequests:@[ req ] error:nil];
    NSMutableArray *lines = [NSMutableArray array];
    for (VNRecognizedTextObservation *o in req.results ?: @[]) {
        VNRecognizedText *t = [[o topCandidates:1] firstObject];
        if (t.string.length < 2 || t.confidence < 0.3) continue;
        [lines addObject:@{ @"t": t.string, @"r": [NSValue valueWithCGRect:o.boundingBox] }];
        if (lines.count >= 24) break;
    }
    dispatch_async(dispatch_get_main_queue(), ^{ [self translateLines:lines imageSize:CGSizeMake(bw, bh)]; });
}

- (CGRect)layerRectForNormalized:(CGRect)nb imageSize:(CGSize)isz {
    CGSize L = _preview.bounds.size;
    if (isz.width <= 0 || isz.height <= 0) return CGRectZero;
    CGFloat scale = MAX(L.width / isz.width, L.height / isz.height);
    CGFloat w = isz.width * scale, h = isz.height * scale;
    CGFloat ox = (L.width - w) / 2, oy = (L.height - h) / 2;
    return CGRectMake(ox + nb.origin.x * w, oy + (1 - nb.origin.y - nb.size.height) * h, nb.size.width * w, nb.size.height * h);
}

- (void)translateLines:(NSArray *)lines imageSize:(CGSize)isz {
    NSMutableArray *missing = [NSMutableArray array];
    for (NSDictionary *l in lines) if (!_cache[l[@"t"]]) [missing addObject:l[@"t"]];
    if (!missing.count) { [self drawLines:lines imageSize:isz]; _busy = NO; return; }
    NSString *joined = [missing componentsJoinedByString:@"\n"];
    NSMutableCharacterSet *allowed = [[NSCharacterSet URLQueryAllowedCharacterSet] mutableCopy];
    [allowed removeCharactersInString:@"&=+?#"];
    NSString *q = [joined stringByAddingPercentEncodingWithAllowedCharacters:allowed];
    NSString *us = [NSString stringWithFormat:@"https://translate.googleapis.com/translate_a/single?client=gtx&dj=1&ie=UTF-8&oe=UTF-8&dt=t&sl=auto&tl=%@&q=%@", self.tl ?: @"ar", q];
    __weak typeof(self) ws = self;
    [[_net dataTaskWithURL:[NSURL URLWithString:us] completionHandler:^(NSData *data, NSURLResponse *resp, NSError *err) {
        NSMutableString *m = [NSMutableString string];
        id j = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
        if ([j isKindOfClass:[NSDictionary class]]) for (id s in j[@"sentences"] ?: @[]) if ([s isKindOfClass:[NSDictionary class]] && [s[@"trans"] isKindOfClass:[NSString class]]) [m appendString:s[@"trans"]];
        NSArray *parts = [m componentsSeparatedByString:@"\n"];
        dispatch_async(dispatch_get_main_queue(), ^{
            TJCameraVC *me = ws; if (!me) return;
            if (parts.count == missing.count) for (NSUInteger i = 0; i < parts.count; i++) me->_cache[missing[i]] = [parts[i] stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceCharacterSet];
            [me drawLines:lines imageSize:isz];
            me->_busy = NO;
        });
    }] resume];
}

- (void)drawLines:(NSArray *)lines imageSize:(CGSize)isz {
    for (UIView *v in _overlay.subviews.copy) [v removeFromSuperview];
    if (!_live) return;
    BOOL rtl = [self.tl isEqualToString:@"ar"] || [self.tl isEqualToString:@"fa"] || [self.tl isEqualToString:@"ur"];
    for (NSDictionary *l in lines) {
        NSString *tr = _cache[l[@"t"]];
        if (!tr.length) continue;
        CGRect r = CGRectInset([self layerRectForNormalized:[l[@"r"] CGRectValue] imageSize:isz], -3, -2);
        UILabel *lab = [[UILabel alloc] initWithFrame:r];
        lab.text = tr;
        lab.textColor = [UIColor colorWithRed:0.08 green:0.1 blue:0.2 alpha:1];
        lab.backgroundColor = [UIColor colorWithRed:0.97 green:0.95 blue:0.9 alpha:0.93];
        lab.layer.cornerRadius = 4; lab.layer.masksToBounds = YES;
        lab.font = [UIFont systemFontOfSize:MAX(11, MIN(28, r.size.height * 0.72)) weight:UIFontWeightSemibold];
        lab.adjustsFontSizeToFitWidth = YES; lab.minimumScaleFactor = 0.35;
        lab.textAlignment = rtl ? NSTextAlignmentRight : NSTextAlignmentLeft;
        [_overlay addSubview:lab];
    }
}
@end

#pragma mark - Media center (delegates and state)

@interface TJMedia : NSObject <UIDocumentPickerDelegate, PHPickerViewControllerDelegate, AVAudioRecorderDelegate, WKNavigationDelegate>
@property (nonatomic, weak) TJViewController *vc;
@property (nonatomic, copy) void (^fileDone)(NSURL *url);
@property (nonatomic, copy) void (^photoDone)(UIImage *img, NSURL *video);
@property (nonatomic) BOOL photoWantsVideo;
@property (nonatomic) BOOL photoScreens;
@property (nonatomic, strong) SFSpeechRecognitionTask *task;
@property (nonatomic) BOOL cancelTranscribe;
@property (nonatomic, strong) AVAudioRecorder *recorder;
@property (nonatomic, strong) AVAudioPlayer *recPlayer;
@property (nonatomic, strong) NSTimer *meter;
@property (nonatomic, strong) WKWebView *pdfWeb;
@property (nonatomic, copy) void (^pdfDone)(NSData *pdf);
+ (instancetype)shared;
@end

@implementation TJMedia
+ (instancetype)shared { static TJMedia *m; static dispatch_once_t o; dispatch_once(&o, ^{ m = [TJMedia new]; }); return m; }

- (UIViewController *)top {
    UIViewController *v = self.vc;
    while (v.presentedViewController) v = v.presentedViewController;
    return v;
}

- (NSURL *)tmp:(NSString *)name {
    NSURL *dir = [NSURL fileURLWithPath:NSTemporaryDirectory() isDirectory:YES];
    return [dir URLByAppendingPathComponent:name];
}

#pragma mark Pickers

- (void)pickFileTypes:(NSArray<UTType *> *)types done:(void (^)(NSURL *))done {
    self.fileDone = done;
    UIDocumentPickerViewController *p = [[UIDocumentPickerViewController alloc] initForOpeningContentTypes:types asCopy:YES];
    p.delegate = self;
    p.allowsMultipleSelection = NO;
    [[self top] presentViewController:p animated:YES completion:nil];
}
- (void)documentPicker:(UIDocumentPickerViewController *)controller didPickDocumentsAtURLs:(NSArray<NSURL *> *)urls {
    void (^cb)(NSURL *) = self.fileDone; self.fileDone = nil;
    if (cb) cb(urls.firstObject);
}
- (void)documentPickerWasCancelled:(UIDocumentPickerViewController *)controller {
    void (^cb)(NSURL *) = self.fileDone; self.fileDone = nil;
    if (cb) cb(nil);
}

- (void)pickPhotoVideo:(BOOL)video done:(void (^)(UIImage *, NSURL *))done {
    self.photoDone = done;
    self.photoWantsVideo = video;
    PHPickerConfiguration *cfg = [PHPickerConfiguration new];
    cfg.selectionLimit = 1;
    cfg.filter = video ? [PHPickerFilter videosFilter] : (self.photoScreens ? [PHPickerFilter screenshotsFilter] : [PHPickerFilter imagesFilter]);
    self.photoScreens = NO;
    PHPickerViewController *p = [[PHPickerViewController alloc] initWithConfiguration:cfg];
    p.delegate = self;
    [[self top] presentViewController:p animated:YES completion:nil];
}
- (void)picker:(PHPickerViewController *)picker didFinishPicking:(NSArray<PHPickerResult *> *)results {
    [picker dismissViewControllerAnimated:YES completion:nil];
    void (^cb)(UIImage *, NSURL *) = self.photoDone; self.photoDone = nil;
    if (!cb) return;
    NSItemProvider *ip = results.firstObject.itemProvider;
    if (!ip) { cb(nil, nil); return; }
    if (self.photoWantsVideo) {
        [ip loadFileRepresentationForTypeIdentifier:UTTypeMovie.identifier completionHandler:^(NSURL *url, NSError *error) {
            NSURL *dst = nil;
            if (url) {
                dst = [self tmp:[NSString stringWithFormat:@"pick-%@.%@", [NSUUID UUID].UUIDString, url.pathExtension.length ? url.pathExtension : @"mov"]];
                [[NSFileManager defaultManager] copyItemAtURL:url toURL:dst error:nil];
            }
            dispatch_async(dispatch_get_main_queue(), ^{ cb(nil, dst); });
        }];
    } else if ([ip canLoadObjectOfClass:[UIImage class]]) {
        [ip loadObjectOfClass:[UIImage class] completionHandler:^(id obj, NSError *error) {
            dispatch_async(dispatch_get_main_queue(), ^{ cb([obj isKindOfClass:[UIImage class]] ? obj : nil, nil); });
        }];
    } else cb(nil, nil);
}

#pragma mark OCR result packaging

- (void)ocrImage:(UIImage *)img preferArabic:(BOOL)ar ok:(TJOk)ok fail:(TJFail)fail {
    if (!img) { fail(@"cancelled", nil); return; }
    UIImage *up = TJUpright(img, 2000);
    TJRecognize(up, ar, VNRequestTextRecognitionLevelAccurate, ^(NSArray *blocks) {
        UIImage *small = TJUpright(up, 1400);
        ok(@{ @"image": TJDataURL(small, 0.72), @"w": @(small.size.width), @"h": @(small.size.height),
              @"blocks": blocks, @"arabicOCR": @(TJOCRSupportsArabic()) });
    });
}

#pragma mark Transcription of audio / video files

- (void)transcribeURL:(NSURL *)url lang:(NSString *)lang ok:(TJOk)ok fail:(TJFail)fail {
    AVURLAsset *asset = [AVURLAsset URLAssetWithURL:url options:nil];
    self.cancelTranscribe = NO;
    [asset loadValuesAsynchronouslyForKeys:@[ @"duration", @"tracks" ] completionHandler:^{
        dispatch_async(dispatch_get_main_queue(), ^{
            double dur = CMTimeGetSeconds(asset.duration);
            if (!(dur > 0)) { fail(@"bad_media", nil); return; }
            if (![asset tracksWithMediaType:AVMediaTypeAudio].count) { fail(@"no_audio", nil); return; }
            SFSpeechRecognizer *rec = [[SFSpeechRecognizer alloc] initWithLocale:[NSLocale localeWithLocaleIdentifier:lang]];
            if (!rec) { fail(@"unsupported_lang", nil); return; }
            const double CH = 50.0;
            NSUInteger n = (NSUInteger)ceil(dur / CH);
            NSMutableArray *segs = [NSMutableArray array];
            __block void (^step)(NSUInteger);
            __weak typeof(self) ws = self;
            step = ^(NSUInteger i) {
                if (i >= n || ws.cancelTranscribe) {
                    ok(@{ @"segments": segs, @"duration": @(dur), @"name": url.lastPathComponent ?: @"", @"cancelled": @(ws.cancelTranscribe) });
                    step = nil;
                    return;
                }
                double start = i * CH;
                CMTimeRange range = CMTimeRangeMake(CMTimeMakeWithSeconds(start, 600), CMTimeMakeWithSeconds(MIN(CH, dur - start), 600));
                AVAssetExportSession *ex = [[AVAssetExportSession alloc] initWithAsset:asset presetName:AVAssetExportPresetAppleM4A];
                NSURL *out = [ws tmp:[NSString stringWithFormat:@"chunk-%lu.m4a", (unsigned long)i]];
                [[NSFileManager defaultManager] removeItemAtURL:out error:nil];
                ex.outputURL = out; ex.outputFileType = AVFileTypeAppleM4A; ex.timeRange = range;
                [ex exportAsynchronouslyWithCompletionHandler:^{
                    dispatch_async(dispatch_get_main_queue(), ^{
                        if (ex.status != AVAssetExportSessionStatusCompleted) {
                            [ws.vc emit:@"transcribeProgress" data:@{ @"done": @(i + 1), @"total": @(n), @"text": @"", @"start": @(start) }];
                            step(i + 1); return;
                        }
                        SFSpeechURLRecognitionRequest *req = [[SFSpeechURLRecognitionRequest alloc] initWithURL:out];
                        req.shouldReportPartialResults = NO;
                        if ([req respondsToSelector:NSSelectorFromString(@"setAddsPunctuation:")]) [req setValue:@YES forKey:@"addsPunctuation"];
                        __block BOOL handled = NO;
                        ws.task = [rec recognitionTaskWithRequest:req resultHandler:^(SFSpeechRecognitionResult *result, NSError *error) {
                            dispatch_async(dispatch_get_main_queue(), ^{
                                if (handled || !(result.isFinal || error)) return;
                                handled = YES;
                                NSString *t = result.bestTranscription.formattedString ?: @"";
                                if (t.length) [segs addObject:@{ @"start": @(start), @"text": t }];
                                [ws.vc emit:@"transcribeProgress" data:@{ @"done": @(i + 1), @"total": @(n), @"text": t, @"start": @(start) }];
                                [[NSFileManager defaultManager] removeItemAtURL:out error:nil];
                                step(i + 1);
                            });
                        }];
                    });
                }];
            };
            step(0);
        });
    }];
}

#pragma mark Documents

- (void)readDocument:(NSURL *)url ok:(TJOk)ok fail:(TJFail)fail {
    if (!url) { fail(@"cancelled", nil); return; }
    NSString *ext = url.pathExtension.lowercaseString;
    NSString *name = url.lastPathComponent ?: @"document";
    if ([ext isEqualToString:@"pdf"]) {
        PDFDocument *doc = [[PDFDocument alloc] initWithURL:url];
        if (!doc) { fail(@"bad_document", nil); return; }
        NSInteger n = MIN(doc.pageCount, 60);
        NSMutableArray *pages = [NSMutableArray array];
        BOOL anyText = NO;
        for (NSInteger i = 0; i < n; i++) {
            NSString *s = [doc pageAtIndex:i].string ?: @"";
            if ([s stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet].length > 20) anyText = YES;
            [pages addObject:s];
        }
        if (anyText) { ok(@{ @"kind": @"pdf", @"name": name, @"pages": pages, @"total": @(doc.pageCount) }); return; }
        // scanned PDF: OCR every page image
        NSMutableArray *ocrPages = [NSMutableArray array];
        __block void (^step)(NSInteger);
        __weak typeof(self) ws = self;
        step = ^(NSInteger i) {
            if (i >= MIN(n, 20)) { ok(@{ @"kind": @"pdf", @"name": name, @"pages": ocrPages, @"total": @(doc.pageCount), @"ocr": @YES }); step = nil; return; }
            PDFPage *pg = [doc pageAtIndex:i];
            CGRect box = [pg boundsForBox:kPDFDisplayBoxMediaBox];
            UIImage *img = [pg thumbnailOfSize:CGSizeMake(box.size.width * 2, box.size.height * 2) forBox:kPDFDisplayBoxMediaBox];
            [ws.vc emit:@"docProgress" data:@{ @"done": @(i + 1), @"total": @(MIN(n, 20)) }];
            TJRecognize(img, YES, VNRequestTextRecognitionLevelAccurate, ^(NSArray *blocks) {
                NSMutableArray *lines = [NSMutableArray array];
                for (NSDictionary *b in blocks) [lines addObject:b[@"text"]];
                [ocrPages addObject:[lines componentsJoinedByString:@"\n"]];
                step(i + 1);
            });
        };
        step(0);
        return;
    }
    NSData *data = [NSData dataWithContentsOfURL:url];
    if (!data) { fail(@"bad_document", nil); return; }
    if ([ext isEqualToString:@"docx"]) { ok(@{ @"kind": @"docx", @"name": name, @"b64": [data base64EncodedStringWithOptions:0] }); return; }
    NSString *text = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] ?: [[NSString alloc] initWithData:data encoding:CFStringConvertEncodingToNSStringEncoding(kCFStringEncodingWindowsArabic)] ?: @"";
    if ([ext isEqualToString:@"rtf"]) {
        NSAttributedString *as = [[NSAttributedString alloc] initWithData:data options:@{ NSDocumentTypeDocumentAttribute: NSRTFTextDocumentType } documentAttributes:nil error:nil];
        text = as.string ?: text;
    }
    ok(@{ @"kind": @"txt", @"name": name, @"text": text });
}

#pragma mark Share sheet

- (void)share:(NSDictionary *)a ok:(TJOk)ok fail:(TJFail)fail {
    NSMutableArray *items = [NSMutableArray array];
    NSString *text = TJS(a, @"text", nil), *url = TJS(a, @"url", nil), *image = TJS(a, @"image", nil);
    NSDictionary *file = [a[@"file"] isKindOfClass:[NSDictionary class]] ? a[@"file"] : nil;
    if (file) {
        NSString *name = TJS(file, @"name", @"file.txt");
        NSURL *u = [self tmp:name];
        [[NSFileManager defaultManager] removeItemAtURL:u error:nil];
        NSData *d = nil;
        if (TJS(file, @"b64", nil)) d = [[NSData alloc] initWithBase64EncodedString:file[@"b64"] options:NSDataBase64DecodingIgnoreUnknownCharacters];
        else d = [TJS(file, @"text", @"") dataUsingEncoding:NSUTF8StringEncoding];
        if ([d writeToURL:u atomically:YES]) [items addObject:u];
    }
    if (image) { UIImage *img = TJImageFromDataURL(image); if (img) [items addObject:img]; }
    if (text.length) [items addObject:text];
    if (url.length) { NSURL *u = [NSURL URLWithString:url]; if (u) [items addObject:u]; }
    if (!items.count) { fail(@"nothing", nil); return; }
    UIActivityViewController *av = [[UIActivityViewController alloc] initWithActivityItems:items applicationActivities:nil];
    UIViewController *top = [self top];
    av.popoverPresentationController.sourceView = top.view;
    av.popoverPresentationController.sourceRect = CGRectMake(top.view.bounds.size.width / 2, top.view.bounds.size.height - 80, 1, 1);
    av.completionWithItemsHandler = ^(UIActivityType type, BOOL completed, NSArray *ret, NSError *err) { ok(@{ @"completed": @(completed) }); };
    [top presentViewController:av animated:YES completion:nil];
}

#pragma mark HTML -> paginated PDF

- (void)makePDF:(NSDictionary *)a ok:(TJOk)ok fail:(TJFail)fail {
    NSString *html = TJS(a, @"html", @"");
    NSString *name = TJS(a, @"name", @"Turjuman.pdf");
    WKWebView *w = [[WKWebView alloc] initWithFrame:CGRectMake(0, 0, 595, 842)];
    w.alpha = 0.01;
    w.navigationDelegate = self;
    [self.vc.view insertSubview:w atIndex:0];
    self.pdfWeb = w;
    __weak typeof(self) ws = self;
    self.pdfDone = ^(NSData *pdf) {
        [ws.pdfWeb removeFromSuperview]; ws.pdfWeb = nil;
        if (!pdf.length) { fail(@"pdf_failed", nil); return; }
        if ([a[@"share"] boolValue] || !a[@"share"]) {
            [ws share:@{ @"file": @{ @"name": name, @"b64": [pdf base64EncodedStringWithOptions:0] } } ok:ok fail:fail];
        } else ok(@{ @"b64": [pdf base64EncodedStringWithOptions:0] });
    };
    [w loadHTMLString:html baseURL:nil];
}
- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
    if (webView != self.pdfWeb) return;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.4 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        UIPrintPageRenderer *r = [UIPrintPageRenderer new];
        [r addPrintFormatter:webView.viewPrintFormatter startingAtPageAtIndex:0];
        CGRect paper = CGRectMake(0, 0, 595.2, 841.8);
        CGRect printable = CGRectInset(paper, 36, 40);
        [r setValue:[NSValue valueWithCGRect:paper] forKey:@"paperRect"];
        [r setValue:[NSValue valueWithCGRect:printable] forKey:@"printableRect"];
        NSMutableData *data = [NSMutableData data];
        UIGraphicsBeginPDFContextToData(data, paper, nil);
        [r prepareForDrawingPages:NSMakeRange(0, r.numberOfPages)];
        for (NSInteger i = 0; i < r.numberOfPages; i++) {
            UIGraphicsBeginPDFPage();
            [r drawPageAtIndex:i inRect:UIGraphicsGetPDFContextBounds()];
        }
        UIGraphicsEndPDFContext();
        if (self.pdfDone) { void (^cb)(NSData *) = self.pdfDone; self.pdfDone = nil; cb(data); }
    });
}
- (void)webView:(WKWebView *)webView didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    if (webView == self.pdfWeb && self.pdfDone) { void (^cb)(NSData *) = self.pdfDone; self.pdfDone = nil; cb(nil); }
}

#pragma mark Voice recorder (record yourself, compare)

- (void)record:(NSDictionary *)a ok:(TJOk)ok fail:(TJFail)fail {
    NSString *act = TJS(a, @"action", @"start");
    NSURL *u = [self tmp:@"my-voice.m4a"];
    if ([act isEqualToString:@"start"]) {
        [[AVAudioSession sharedInstance] requestRecordPermission:^(BOOL granted) {
            dispatch_async(dispatch_get_main_queue(), ^{
                if (!granted) { fail(@"mic_denied", nil); return; }
                [self.recPlayer stop];
                AVAudioSession *s = [AVAudioSession sharedInstance];
                [s setCategory:AVAudioSessionCategoryPlayAndRecord mode:AVAudioSessionModeDefault options:AVAudioSessionCategoryOptionDefaultToSpeaker error:nil];
                [s setActive:YES error:nil];
                NSDictionary *set = @{ AVFormatIDKey: @(kAudioFormatMPEG4AAC), AVSampleRateKey: @44100, AVNumberOfChannelsKey: @1, AVEncoderAudioQualityKey: @(AVAudioQualityHigh) };
                [[NSFileManager defaultManager] removeItemAtURL:u error:nil];
                NSError *e = nil;
                self.recorder = [[AVAudioRecorder alloc] initWithURL:u settings:set error:&e];
                if (!self.recorder) { fail(@"rec_failed", e.localizedDescription); return; }
                self.recorder.meteringEnabled = YES;
                [self.recorder recordForDuration:30];
                __weak typeof(self) ws = self;
                [self.meter invalidate];
                self.meter = [NSTimer scheduledTimerWithTimeInterval:0.06 repeats:YES block:^(NSTimer *t) {
                    if (!ws.recorder.isRecording) { [t invalidate]; [ws.vc emit:@"recState" data:@{ @"on": @NO }]; return; }
                    [ws.recorder updateMeters];
                    double db = [ws.recorder averagePowerForChannel:0];
                    [ws.vc emit:@"recLevel" data:@{ @"v": @(fmin(1, fmax(0, (db + 50) / 50))) }];
                }];
                ok(@{});
            });
        }];
    } else if ([act isEqualToString:@"stop"]) {
        NSTimeInterval d = self.recorder.currentTime;
        [self.recorder stop];
        [self.meter invalidate];
        [self.vc usePlaybackSession];
        ok(@{ @"duration": @(d) });
    } else if ([act isEqualToString:@"play"]) {
        [self.vc usePlaybackSession];
        NSError *e = nil;
        self.recPlayer = [[AVAudioPlayer alloc] initWithContentsOfURL:u error:&e];
        if (!self.recPlayer) { fail(@"no_recording", nil); return; }
        self.recPlayer.rate = [a[@"rate"] isKindOfClass:[NSNumber class]] ? [a[@"rate"] floatValue] : 1;
        self.recPlayer.enableRate = YES;
        [self.recPlayer play];
        ok(@{ @"duration": @(self.recPlayer.duration) });
    } else if ([act isEqualToString:@"stopPlay"]) { [self.recPlayer stop]; ok(@{}); }
    else fail(@"bad_action", act);
}
@end

#pragma mark - Command routing

@implementation TJViewController (Media)

- (BOOL)handleMediaCommand:(NSString *)cmd args:(NSDictionary *)a ok:(TJOk)ok fail:(TJFail)fail {
    TJMedia *m = [TJMedia shared];
    m.vc = self;
    if ([cmd isEqualToString:@"camera"]) {
        [AVCaptureDevice requestAccessForMediaType:AVMediaTypeVideo completionHandler:^(BOOL granted) {
            dispatch_async(dispatch_get_main_queue(), ^{
                if (!granted) { fail(@"camera_denied", nil); return; }
                TJCameraVC *c = [TJCameraVC new];
                NSString *tl = TJS(a, @"tl", @"ar");
                c.tl = tl;
                c.modalPresentationStyle = UIModalPresentationFullScreen;
                c.done = ^(UIImage *photo) {
                    if (!photo) { ok(@{ @"cancelled": @YES }); return; }
                    [m ocrImage:photo preferArabic:![tl isEqualToString:@"ar"] ok:ok fail:fail];
                };
                [[m top] presentViewController:c animated:YES completion:nil];
            });
        }];
        return YES;
    }
    if ([cmd isEqualToString:@"pickPhoto"]) {
        m.photoScreens = [a[@"screenshots"] boolValue];
        [m pickPhotoVideo:NO done:^(UIImage *img, NSURL *v) {
            if (!img) { ok(@{ @"cancelled": @YES }); return; }
            [m ocrImage:img preferArabic:[a[@"preferArabic"] boolValue] ok:ok fail:fail];
        }];
        return YES;
    }
    if ([cmd isEqualToString:@"ocr"]) {
        UIImage *img = TJImageFromDataURL(TJS(a, @"image", @""));
        if (!img) { fail(@"bad_image", nil); return YES; }
        UIImage *up = TJUpright(img, 2000);
        TJRecognize(up, [a[@"preferArabic"] boolValue], VNRequestTextRecognitionLevelAccurate, ^(NSArray *blocks) {
            ok(@{ @"blocks": blocks, @"arabicOCR": @(TJOCRSupportsArabic()) });
        });
        return YES;
    }
    if ([cmd isEqualToString:@"ocrClipboard"]) {
        UIImage *img = [UIPasteboard generalPasteboard].image;
        if (!img) { ok(@{ @"cancelled": @YES }); return YES; }
        [m ocrImage:img preferArabic:[a[@"preferArabic"] boolValue] ok:ok fail:fail];
        return YES;
    }
    if ([cmd isEqualToString:@"ocrInfo"]) { ok(@{ @"arabic": @(TJOCRSupportsArabic()) }); return YES; }
    if ([cmd isEqualToString:@"transcribeFile"]) {
        NSString *lang = TJS(a, @"lang", @"en-US");
        BOOL photos = [TJS(a, @"source", @"files") isEqualToString:@"photos"];
        [SFSpeechRecognizer requestAuthorization:^(SFSpeechRecognizerAuthorizationStatus st) {
            dispatch_async(dispatch_get_main_queue(), ^{
                if (st != SFSpeechRecognizerAuthorizationStatusAuthorized) { fail(@"speech_denied", nil); return; }
                void (^go)(NSURL *) = ^(NSURL *url) {
                    if (!url) { ok(@{ @"cancelled": @YES }); return; }
                    [self emit:@"transcribeStart" data:@{ @"name": url.lastPathComponent ?: @"" }];
                    [m transcribeURL:url lang:lang ok:ok fail:fail];
                };
                if (photos) [m pickPhotoVideo:YES done:^(UIImage *i, NSURL *v) { go(v); }];
                else [m pickFileTypes:@[ UTTypeAudio, UTTypeMovie, UTTypeAudiovisualContent ] done:go];
            });
        }];
        return YES;
    }
    if ([cmd isEqualToString:@"transcribeCancel"]) { m.cancelTranscribe = YES; [m.task cancel]; ok(@{}); return YES; }
    if ([cmd isEqualToString:@"pickDocument"]) {
        UTType *docx = [UTType typeWithFilenameExtension:@"docx"] ?: UTTypeData;
        [m pickFileTypes:@[ UTTypePDF, docx, UTTypePlainText, UTTypeRTF, UTTypeText ] done:^(NSURL *url) {
            if (!url) { ok(@{ @"cancelled": @YES }); return; }
            [m readDocument:url ok:ok fail:fail];
        }];
        return YES;
    }
    if ([cmd isEqualToString:@"share"]) { [m share:a ok:ok fail:fail]; return YES; }
    if ([cmd isEqualToString:@"makePDF"]) { [m makePDF:a ok:ok fail:fail]; return YES; }
    if ([cmd isEqualToString:@"record"]) { [m record:a ok:ok fail:fail]; return YES; }
    return NO;
}
@end
