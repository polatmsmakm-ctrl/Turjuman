// Turjuman share extension: "Share → ترجمان" from any app. Translates shared text, links (page text) and images (OCR).
#import <UIKit/UIKit.h>
#import <Vision/Vision.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

@interface TJShareVC : UIViewController
@end

@implementation TJShareVC {
    UIView *_card;
    UILabel *_title, *_status;
    UISegmentedControl *_seg;
    UITextView *_src, *_out;
    UIButton *_copy, *_done;
    UIActivityIndicatorView *_spin;
    NSString *_text;
    NSURLSession *_net;
    NSUInteger _req;
}

static BOOL TJShareIsArabic(NSString *s) {
    NSUInteger ar = 0, la = 0;
    for (NSUInteger i = 0; i < s.length; i++) {
        unichar c = [s characterAtIndex:i];
        if (c >= 0x0600 && c <= 0x06FF) ar++; else if ((c | 32) >= 'a' && (c | 32) <= 'z') la++;
    }
    return ar > la;
}

- (void)viewDidLoad {
    [super viewDidLoad];
    _net = [NSURLSession sessionWithConfiguration:[NSURLSessionConfiguration ephemeralSessionConfiguration]];
    self.view.backgroundColor = [UIColor colorWithWhite:0 alpha:0.35];
    _card = [UIView new];
    _card.backgroundColor = [UIColor systemBackgroundColor];
    _card.layer.cornerRadius = 20;
    [self.view addSubview:_card];
    _title = [UILabel new];
    _title.text = @"ترجمان";
    _title.font = [UIFont systemFontOfSize:20 weight:UIFontWeightBold];
    _title.textAlignment = NSTextAlignmentRight;
    [_card addSubview:_title];
    _seg = [[UISegmentedControl alloc] initWithItems:@[ @"English", @"العربية" ]];
    [_seg addTarget:self action:@selector(retranslate) forControlEvents:UIControlEventValueChanged];
    [_card addSubview:_seg];
    _src = [self textView:15 color:[UIColor secondaryLabelColor]];
    _out = [self textView:20 color:[UIColor labelColor]];
    _status = [UILabel new];
    _status.font = [UIFont systemFontOfSize:13];
    _status.textColor = [UIColor secondaryLabelColor];
    _status.textAlignment = NSTextAlignmentCenter;
    _status.numberOfLines = 2;
    [_card addSubview:_status];
    _spin = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleMedium];
    _spin.hidesWhenStopped = YES;
    [_card addSubview:_spin];
    _copy = [self button:@"نسخ الترجمة" filled:YES action:@selector(copyTapped)];
    _done = [self button:@"تم" filled:NO action:@selector(doneTapped)];
    [self loadInput];
}

- (UITextView *)textView:(CGFloat)size color:(UIColor *)color {
    UITextView *t = [UITextView new];
    t.editable = NO;
    t.font = [UIFont systemFontOfSize:size];
    t.textColor = color;
    t.backgroundColor = [UIColor secondarySystemBackgroundColor];
    t.layer.cornerRadius = 12;
    t.textContainerInset = UIEdgeInsetsMake(10, 10, 10, 10);
    [_card addSubview:t];
    return t;
}

- (UIButton *)button:(NSString *)title filled:(BOOL)filled action:(SEL)sel {
    UIButton *b = [UIButton buttonWithType:UIButtonTypeSystem];
    [b setTitle:title forState:UIControlStateNormal];
    b.titleLabel.font = [UIFont systemFontOfSize:16 weight:UIFontWeightSemibold];
    b.layer.cornerRadius = 12;
    b.backgroundColor = filled ? [UIColor colorWithRed:0.12 green:0.23 blue:0.56 alpha:1] : [UIColor secondarySystemBackgroundColor];
    [b setTitleColor:filled ? UIColor.whiteColor : [UIColor labelColor] forState:UIControlStateNormal];
    [b addTarget:self action:sel forControlEvents:UIControlEventTouchUpInside];
    [_card addSubview:b];
    return b;
}

- (void)viewDidLayoutSubviews {
    [super viewDidLayoutSubviews];
    CGRect b = self.view.bounds;
    UIEdgeInsets sa = self.view.safeAreaInsets;
    CGFloat w = MIN(b.size.width - 24, 560), h = MIN(b.size.height - sa.top - 40, 620);
    _card.frame = CGRectMake((b.size.width - w) / 2, b.size.height - h - MAX(sa.bottom, 12), w, h);
    CGFloat p = 16, y = 14;
    _title.frame = CGRectMake(p, y, w - 2 * p, 28); y += 38;
    _seg.frame = CGRectMake(p, y, w - 2 * p, 32); y += 44;
    CGFloat avail = h - y - 120;
    _src.frame = CGRectMake(p, y, w - 2 * p, avail * 0.38); y += avail * 0.38 + 10;
    _out.frame = CGRectMake(p, y, w - 2 * p, avail * 0.62); y += avail * 0.62 + 6;
    _status.frame = CGRectMake(p, y, w - 2 * p, 34);
    _spin.center = CGPointMake(w / 2, CGRectGetMidY(_out.frame));
    CGFloat bw = (w - 3 * p) / 2;
    _done.frame = CGRectMake(p, h - 64, bw, 48);
    _copy.frame = CGRectMake(2 * p + bw, h - 64, bw, 48);
}

#pragma mark Input

- (void)loadInput {
    NSExtensionItem *item = self.extensionContext.inputItems.firstObject;
    NSArray<NSItemProvider *> *atts = item.attachments ?: @[];
    for (NSItemProvider *ip in atts) {
        if ([ip hasItemConformingToTypeIdentifier:UTTypeImage.identifier]) {
            [self setStatus:@"جاري قراءة الكلام من الصورة…" busy:YES];
            [ip loadObjectOfClass:[UIImage class] completionHandler:^(id obj, NSError *error) {
                UIImage *img = [obj isKindOfClass:[UIImage class]] ? obj : nil;
                dispatch_async(dispatch_get_main_queue(), ^{ if (img) [self ocr:img]; else [self setStatus:@"ما قدرت أفتح الصورة" busy:NO]; });
            }];
            return;
        }
    }
    for (NSItemProvider *ip in atts) {
        if ([ip hasItemConformingToTypeIdentifier:UTTypeURL.identifier] && ![ip hasItemConformingToTypeIdentifier:UTTypePlainText.identifier]) {
            [ip loadItemForTypeIdentifier:UTTypeURL.identifier options:nil completionHandler:^(id<NSSecureCoding> obj, NSError *error) {
                NSURL *u = [(NSObject *)obj isKindOfClass:[NSURL class]] ? (NSURL *)obj : nil;
                dispatch_async(dispatch_get_main_queue(), ^{ if (u) [self fetchPage:u]; });
            }];
            return;
        }
    }
    for (NSItemProvider *ip in atts) {
        if ([ip hasItemConformingToTypeIdentifier:UTTypePlainText.identifier]) {
            [ip loadItemForTypeIdentifier:UTTypePlainText.identifier options:nil completionHandler:^(id<NSSecureCoding> obj, NSError *error) {
                NSString *t = [(NSObject *)obj isKindOfClass:[NSString class]] ? (NSString *)obj : ([(NSObject *)obj isKindOfClass:[NSURL class]] ? [(NSURL *)obj absoluteString] : nil);
                dispatch_async(dispatch_get_main_queue(), ^{ [self useText:t ?: @""]; });
            }];
            return;
        }
    }
    if (item.attributedContentText.string.length) { [self useText:item.attributedContentText.string]; return; }
    [self setStatus:@"ما فيه نص أترجمه" busy:NO];
}

- (void)useText:(NSString *)t {
    _text = [t stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
    if (_text.length > 4000) _text = [_text substringToIndex:4000];
    _src.text = _text;
    _src.textAlignment = TJShareIsArabic(_text) ? NSTextAlignmentRight : NSTextAlignmentLeft;
    _seg.selectedSegmentIndex = TJShareIsArabic(_text) ? 0 : 1;
    [self retranslate];
}

- (void)ocr:(UIImage *)img {
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        VNRecognizeTextRequest *req = [VNRecognizeTextRequest new];
        req.recognitionLevel = VNRequestTextRecognitionLevelAccurate;
        req.usesLanguageCorrection = YES;
        NSArray *sup = [req supportedRecognitionLanguagesAndReturnError:nil];
        NSMutableArray *langs = [NSMutableArray arrayWithObject:@"en-US"];
        if ([sup containsObject:@"ar-SA"]) [langs addObject:@"ar-SA"];
        req.recognitionLanguages = langs;
        CGImagePropertyOrientation o = kCGImagePropertyOrientationUp;
        switch (img.imageOrientation) {
            case UIImageOrientationDown: o = kCGImagePropertyOrientationDown; break;
            case UIImageOrientationLeft: o = kCGImagePropertyOrientationLeft; break;
            case UIImageOrientationRight: o = kCGImagePropertyOrientationRight; break;
            case UIImageOrientationUpMirrored: o = kCGImagePropertyOrientationUpMirrored; break;
            case UIImageOrientationDownMirrored: o = kCGImagePropertyOrientationDownMirrored; break;
            case UIImageOrientationLeftMirrored: o = kCGImagePropertyOrientationLeftMirrored; break;
            case UIImageOrientationRightMirrored: o = kCGImagePropertyOrientationRightMirrored; break;
            default: break;
        }
        VNImageRequestHandler *h = [[VNImageRequestHandler alloc] initWithCGImage:img.CGImage orientation:o options:@{}];
        [h performRequests:@[ req ] error:nil];
        NSMutableArray *lines = [NSMutableArray array];
        for (VNRecognizedTextObservation *o in req.results ?: @[]) {
            NSString *s = [[o topCandidates:1] firstObject].string;
            if (s.length) [lines addObject:s];
        }
        dispatch_async(dispatch_get_main_queue(), ^{
            if (!lines.count) { [self setStatus:@"ما لقيت كلام في الصورة" busy:NO]; return; }
            [self useText:[lines componentsJoinedByString:@"\n"]];
        });
    });
}

- (void)fetchPage:(NSURL *)u {
    [self setStatus:@"جاري فتح الرابط…" busy:YES];
    NSMutableURLRequest *r = [NSMutableURLRequest requestWithURL:u];
    [r setValue:@"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" forHTTPHeaderField:@"User-Agent"];
    [[_net dataTaskWithRequest:r completionHandler:^(NSData *data, NSURLResponse *resp, NSError *err) {
        NSString *html = data ? ([[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] ?: @"") : @"";
        NSMutableArray *paras = [NSMutableArray array];
        NSRegularExpression *re = [NSRegularExpression regularExpressionWithPattern:@"<(p|h1|h2)[^>]*>([\\s\\S]*?)</\\1>" options:NSRegularExpressionCaseInsensitive error:nil];
        NSRegularExpression *tags = [NSRegularExpression regularExpressionWithPattern:@"<[^>]+>" options:0 error:nil];
        for (NSTextCheckingResult *m in [re matchesInString:html options:0 range:NSMakeRange(0, html.length)]) {
            NSString *inner = [html substringWithRange:[m rangeAtIndex:2]];
            inner = [tags stringByReplacingMatchesInString:inner options:0 range:NSMakeRange(0, inner.length) withTemplate:@""];
            inner = [[inner stringByReplacingOccurrencesOfString:@"&nbsp;" withString:@" "] stringByReplacingOccurrencesOfString:@"&amp;" withString:@"&"];
            inner = [inner stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
            if (inner.length > 30) [paras addObject:inner];
            if ([[paras componentsJoinedByString:@"\n\n"] length] > 2500) break;
        }
        dispatch_async(dispatch_get_main_queue(), ^{
            if (!paras.count) { [self useText:u.absoluteString]; return; }
            [self useText:[paras componentsJoinedByString:@"\n\n"]];
        });
    }] resume];
}

#pragma mark Translate

- (void)setStatus:(NSString *)s busy:(BOOL)busy {
    _status.text = s;
    if (busy) [_spin startAnimating]; else [_spin stopAnimating];
}

- (void)retranslate { [self translateUsingPost:YES]; }

- (void)translateUsingPost:(BOOL)post {
    if (!_text.length) return;
    NSString *tl = _seg.selectedSegmentIndex == 0 ? @"en" : @"ar";
    _out.textAlignment = [tl isEqualToString:@"ar"] ? NSTextAlignmentRight : NSTextAlignmentLeft;
    _out.text = @"";
    [self setStatus:@"جاري الترجمة…" busy:YES];
    NSUInteger req = ++_req;
    NSMutableCharacterSet *allowed = [[NSCharacterSet URLQueryAllowedCharacterSet] mutableCopy];
    [allowed removeCharactersInString:@"&=+?#"];
    NSString *base = [NSString stringWithFormat:@"https://translate.googleapis.com/translate_a/single?client=gtx&dj=1&ie=UTF-8&oe=UTF-8&dt=t&sl=auto&tl=%@", tl];
    NSMutableURLRequest *r;
    if (post) {
        r = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:base]];
        r.HTTPMethod = @"POST";
        r.HTTPBody = [[@"q=" stringByAppendingString:[_text stringByAddingPercentEncodingWithAllowedCharacters:allowed]] dataUsingEncoding:NSUTF8StringEncoding];
        [r setValue:@"application/x-www-form-urlencoded;charset=UTF-8" forHTTPHeaderField:@"Content-Type"];
    } else {
        NSString *t = _text.length > 1400 ? [_text substringToIndex:1400] : _text;
        r = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:[base stringByAppendingFormat:@"&q=%@", [t stringByAddingPercentEncodingWithAllowedCharacters:allowed]]]];
    }
    __weak typeof(self) ws = self;
    [[_net dataTaskWithRequest:r completionHandler:^(NSData *data, NSURLResponse *resp, NSError *err) {
        NSMutableString *m = [NSMutableString string];
        id j = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
        if ([j isKindOfClass:[NSDictionary class]]) for (id s in j[@"sentences"] ?: @[]) if ([s isKindOfClass:[NSDictionary class]] && [s[@"trans"] isKindOfClass:[NSString class]]) [m appendString:s[@"trans"]];
        dispatch_async(dispatch_get_main_queue(), ^{
            TJShareVC *me = ws; if (!me || req != me->_req) return;
            if (!m.length && post) { [me translateUsingPost:NO]; return; }
            if (!m.length) { [me setStatus:@"تعذر الاتصال بخدمة الترجمة" busy:NO]; return; }
            me->_out.text = m;
            [me setStatus:@"" busy:NO];
        });
    }] resume];
}

- (void)copyTapped {
    if (!_out.text.length) return;
    [UIPasteboard generalPasteboard].string = _out.text;
    [self setStatus:@"نُسخت الترجمة" busy:NO];
    [[UINotificationFeedbackGenerator new] notificationOccurred:UINotificationFeedbackTypeSuccess];
}

- (void)doneTapped { [self.extensionContext completeRequestReturningItems:@[] completionHandler:nil]; }
@end
