// Turjuman keyboard (ترجمان) — custom iOS keyboard extension.
// English + Arabic + numbers/symbols, iOS-style keys, long-press alternates, space-bar cursor,
// and a translate bar that translates what you typed (Arabic <-> English) in any app.

#import <UIKit/UIKit.h>
#import <QuartzCore/QuartzCore.h>

static NSUInteger TJComposedCount(NSString *s) {
    __block NSUInteger n = 0;
    [s enumerateSubstringsInRange:NSMakeRange(0, s.length) options:NSStringEnumerationByComposedCharacterSequences
                       usingBlock:^(NSString *sub, NSRange r, NSRange er, BOOL *stop) { n++; }];
    return n;
}
static NSArray<NSString *> *TJChars(NSString *s) {
    NSMutableArray *a = [NSMutableArray array];
    [s enumerateSubstringsInRange:NSMakeRange(0, s.length) options:NSStringEnumerationByComposedCharacterSequences
                       usingBlock:^(NSString *sub, NSRange r, NSRange er, BOOL *stop) { [a addObject:sub]; }];
    return a;
}
static BOOL TJIsArabicChar(unichar c) { return (c >= 0x0600 && c <= 0x06FF) || (c >= 0x0750 && c <= 0x077F) || (c >= 0xFB50 && c <= 0xFEFF); }

typedef NS_ENUM(NSInteger, KBKind) { KBKindChar, KBKindShift, KBKindDelete, KBKindMode, KBKindLang, KBKindSpace, KBKindReturn };
typedef NS_ENUM(NSInteger, KBPage) { KBPageLetters, KBPageNumbers, KBPageSymbols };

#pragma mark - Key view

@interface KBKey : UIView
@property (nonatomic) KBKind kind;
@property (nonatomic, copy) NSString *value;
@property (nonatomic, copy) NSArray<NSString *> *alts;
@property (nonatomic) CGFloat units;         // width in key units, 0 = flexible
@property (nonatomic) CGFloat unitWidth;     // points per unit for this row
@property (nonatomic) KBPage target;         // for mode keys
@property (nonatomic) BOOL functional;
@property (nonatomic) BOOL pressed;
@property (nonatomic, strong) UILabel *label;
@property (nonatomic, strong) UIImageView *icon;
@property (nonatomic, strong) UILabel *sub;  // small hint (space bar language)
@end
@implementation KBKey
- (instancetype)init {
    if ((self = [super initWithFrame:CGRectZero])) {
        self.userInteractionEnabled = NO;
        self.layer.cornerRadius = 8.5;
        self.layer.shadowColor = [UIColor blackColor].CGColor;
        self.layer.shadowOpacity = 0.28;
        self.layer.shadowOffset = CGSizeMake(0, 1);
        self.layer.shadowRadius = 0;
        _label = [UILabel new];
        _label.textAlignment = NSTextAlignmentCenter;
        _label.adjustsFontSizeToFitWidth = YES;
        _label.minimumScaleFactor = 0.6;
        [self addSubview:_label];
        _icon = [UIImageView new];
        _icon.contentMode = UIViewContentModeCenter;
        [self addSubview:_icon];
    }
    return self;
}
- (void)layoutSubviews {
    [super layoutSubviews];
    self.layer.shadowPath = [UIBezierPath bezierPathWithRoundedRect:self.bounds cornerRadius:self.layer.cornerRadius].CGPath;
    CGRect b = self.bounds;
    _label.frame = CGRectInset(b, 2, 0);
    if (self.kind == KBKindChar && self.label.font.pointSize > 21) _label.frame = CGRectOffset(CGRectInset(b, 2, 0), 0, -1.5);
    _icon.frame = b;
    if (_sub) _sub.frame = CGRectMake(0, 0, b.size.width, b.size.height);
}
@end

#pragma mark - Keys container (central touch handling)

@class KeyboardViewController;
@interface KBKeysView : UIView
@property (nonatomic, weak) KeyboardViewController *kb;
@end

@interface KBTouch : NSObject
@property (nonatomic, weak) KBKey *key;
@property (nonatomic) CGPoint start;
@property (nonatomic) CGFloat lastX;
@property (nonatomic, strong) NSTimer *timer;
@property (nonatomic) BOOL longMode;
@property (nonatomic) NSInteger altIndex;
@property (nonatomic) NSInteger repeats;
@end
@implementation KBTouch
@end

#pragma mark - Input view with click sounds

@interface KBInputView : UIInputView <UIInputViewAudioFeedback>
@end
@implementation KBInputView
- (BOOL)enableInputClicksWhenVisible { return YES; }
@end

#pragma mark - Controller

@interface KeyboardViewController : UIInputViewController
- (void)keysTouchesBegan:(NSSet<UITouch *> *)touches;
- (void)keysTouchesMoved:(NSSet<UITouch *> *)touches;
- (void)keysTouchesEnded:(NSSet<UITouch *> *)touches cancelled:(BOOL)cancelled;
@end

@implementation KBKeysView
- (void)touchesBegan:(NSSet<UITouch *> *)t withEvent:(UIEvent *)e { [self.kb keysTouchesBegan:t]; }
- (void)touchesMoved:(NSSet<UITouch *> *)t withEvent:(UIEvent *)e { [self.kb keysTouchesMoved:t]; }
- (void)touchesEnded:(NSSet<UITouch *> *)t withEvent:(UIEvent *)e { [self.kb keysTouchesEnded:t cancelled:NO]; }
- (void)touchesCancelled:(NSSet<UITouch *> *)t withEvent:(UIEvent *)e { [self.kb keysTouchesEnded:t cancelled:YES]; }
@end

@implementation KeyboardViewController {
    UIView *_bar;
    UIButton *_trBtn, *_undoBtn;
    UILabel *_status;
    UIActivityIndicatorView *_spin;
    KBKeysView *_keysView;
    UIButton *_globe;
    NSMutableArray<NSArray<KBKey *> *> *_rows;
    NSLayoutConstraint *_heightC;
    KBPage _page;
    BOOL _arabic, _shift, _caps, _dark, _cursorMode, _lastLand;
    NSTimeInterval _lastShiftTap, _lastSpaceTap;
    NSMutableDictionary<NSValue *, KBTouch *> *_touches;
    UIView *_popup; UILabel *_popupLabel;
    UIView *_altPopup; NSMutableArray<UILabel *> *_altLabels; BOOL _altLeftwards; CGFloat _altStartX, _altCellW;
    NSDictionary *_undo;
    NSUInteger _req;
    NSURLSession *_session;
}

#pragma mark Lifecycle

- (void)loadView {
    KBInputView *v = [[KBInputView alloc] initWithFrame:CGRectMake(0, 0, 320, 260) inputViewStyle:UIInputViewStyleKeyboard];
    v.allowsSelfSizing = YES;
    self.view = v;
}

- (void)viewDidLoad {
    [super viewDidLoad];
    _touches = [NSMutableDictionary dictionary];
    _arabic = [[NSUserDefaults standardUserDefaults] boolForKey:@"kb.arabic"];
    _session = [NSURLSession sessionWithConfiguration:[NSURLSessionConfiguration ephemeralSessionConfiguration]];

    _bar = [UIView new];
    [self.view addSubview:_bar];
    _status = [UILabel new];
    _status.font = [UIFont systemFontOfSize:13 weight:UIFontWeightSemibold];
    _status.numberOfLines = 2;
    _status.adjustsFontSizeToFitWidth = YES;
    _status.minimumScaleFactor = 0.75;
    [_bar addSubview:_status];
    _spin = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleMedium];
    _spin.hidesWhenStopped = YES;
    [_bar addSubview:_spin];
    _trBtn = [UIButton buttonWithType:UIButtonTypeSystem];
    _trBtn.titleLabel.font = [UIFont systemFontOfSize:14 weight:UIFontWeightSemibold];
    _trBtn.layer.cornerRadius = 15;
    _trBtn.contentEdgeInsets = UIEdgeInsetsMake(0, 12, 0, 12);
    [_trBtn addTarget:self action:@selector(translateTapped) forControlEvents:UIControlEventTouchUpInside];
    [_bar addSubview:_trBtn];
    _undoBtn = [UIButton buttonWithType:UIButtonTypeSystem];
    _undoBtn.titleLabel.font = [UIFont systemFontOfSize:14 weight:UIFontWeightSemibold];
    [_undoBtn setTitle:@"تراجع" forState:UIControlStateNormal];
    _undoBtn.hidden = YES;
    [_undoBtn addTarget:self action:@selector(undoTapped) forControlEvents:UIControlEventTouchUpInside];
    [_bar addSubview:_undoBtn];

    _keysView = [KBKeysView new];
    _keysView.kb = self;
    _keysView.multipleTouchEnabled = YES;
    _keysView.exclusiveTouch = NO;
    [self.view addSubview:_keysView];

    _popup = [UIView new];
    _popup.userInteractionEnabled = NO;
    _popup.hidden = YES;
    _popup.layer.cornerRadius = 10;
    _popup.layer.shadowColor = [UIColor blackColor].CGColor;
    _popup.layer.shadowOpacity = 0.3;
    _popup.layer.shadowRadius = 4;
    _popup.layer.shadowOffset = CGSizeMake(0, 2);
    _popupLabel = [UILabel new];
    _popupLabel.textAlignment = NSTextAlignmentCenter;
    [_popup addSubview:_popupLabel];
    [self.view addSubview:_popup];

    _altPopup = [UIView new];
    _altPopup.userInteractionEnabled = NO;
    _altPopup.hidden = YES;
    _altPopup.layer.cornerRadius = 10;
    _altPopup.layer.shadowColor = [UIColor blackColor].CGColor;
    _altPopup.layer.shadowOpacity = 0.35;
    _altPopup.layer.shadowRadius = 5;
    _altPopup.layer.shadowOffset = CGSizeMake(0, 2);
    [self.view addSubview:_altPopup];
    _altLabels = [NSMutableArray array];

    _heightC = [self.view.heightAnchor constraintEqualToConstant:[self desiredHeight]];
    _heightC.priority = 999;
    _heightC.active = YES;
    [self rebuildKeys];
}

- (void)viewWillAppear:(BOOL)animated {
    [super viewWillAppear:animated];
    _page = KBPageLetters;
    [self updateAppearance];
    [self rebuildKeys];
    [self updateShift];
    [self updateBar];
}

- (void)viewWillTransitionToSize:(CGSize)size withTransitionCoordinator:(id<UIViewControllerTransitionCoordinator>)coordinator {
    [super viewWillTransitionToSize:size withTransitionCoordinator:coordinator];
    [coordinator animateAlongsideTransition:^(id ctx) {
        self->_heightC.constant = [self desiredHeight];
        [self.view setNeedsLayout];
    } completion:nil];
}

- (void)textDidChange:(id<UITextInput>)textInput {
    [self updateAppearance];
    [self updateShift];
    [self updateReturnKey];
    [self updateBar];
}

- (BOOL)isLandscape {
    CGSize s = [UIScreen mainScreen].bounds.size;
    return s.width > s.height && UIDevice.currentDevice.userInterfaceIdiom == UIUserInterfaceIdiomPhone;
}
- (CGFloat)barHeight { return [self isLandscape] ? 36 : 44; }
- (CGFloat)keyHeight { return [self isLandscape] ? 32 : 43; }
- (CGFloat)rowGap { return [self isLandscape] ? 6 : 11; }
- (CGFloat)desiredHeight { return [self barHeight] + 6 + 4 * [self keyHeight] + 3 * [self rowGap] + 4; }

#pragma mark Colors

- (void)updateAppearance {
    BOOL dark = self.textDocumentProxy.keyboardAppearance == UIKeyboardAppearanceDark ||
                self.traitCollection.userInterfaceStyle == UIUserInterfaceStyleDark;
    if (dark != _dark || !_rows) { _dark = dark; [self recolor]; }
}
- (UIColor *)charColor { return _dark ? [UIColor colorWithWhite:0.42 alpha:1] : [UIColor whiteColor]; }
- (UIColor *)funcColor { return _dark ? [UIColor colorWithWhite:0.27 alpha:1] : [UIColor colorWithRed:0.67 green:0.69 blue:0.73 alpha:1]; }
- (UIColor *)textColor { return _dark ? [UIColor whiteColor] : [UIColor blackColor]; }
- (UIColor *)accent { return _dark ? [UIColor colorWithRed:0.56 green:0.65 blue:1 alpha:1] : [UIColor colorWithRed:0.12 green:0.23 blue:0.56 alpha:1]; }

- (void)paintKey:(KBKey *)k {
    BOOL ret = k.kind == KBKindReturn && [self returnIsBlue];
    UIColor *bg = k.functional ? [self funcColor] : [self charColor];
    if (k.pressed) bg = k.functional ? [self charColor] : [self funcColor];
    if (ret) bg = k.pressed ? [UIColor colorWithRed:0.1 green:0.4 blue:0.9 alpha:1] : [UIColor systemBlueColor];
    k.backgroundColor = bg;
    UIColor *fg = ret ? [UIColor whiteColor] : [self textColor];
    k.label.textColor = fg;
    k.icon.tintColor = fg;
    k.sub.textColor = _dark ? [UIColor colorWithWhite:1 alpha:0.45] : [UIColor colorWithWhite:0 alpha:0.35];
}

- (void)recolor {
    for (NSArray *row in _rows) for (KBKey *k in row) [self paintKey:k];
    if (_globe) { _globe.backgroundColor = [self funcColor]; _globe.tintColor = [self textColor]; }
    _popup.backgroundColor = [self charColor];
    _popupLabel.textColor = [self textColor];
    _altPopup.backgroundColor = [self charColor];
    _status.textColor = _dark ? [UIColor colorWithWhite:1 alpha:0.75] : [UIColor colorWithWhite:0 alpha:0.6];
    _spin.color = [self textColor];
    [_undoBtn setTitleColor:[self accent] forState:UIControlStateNormal];
    [self updateBar];
}

#pragma mark Building keys

- (KBKey *)charKey:(NSString *)c units:(CGFloat)u {
    KBKey *k = [KBKey new];
    k.kind = KBKindChar; k.value = c; k.units = u;
    k.alts = [self altsFor:c];
    return k;
}
- (KBKey *)funcKey:(KBKind)kind units:(CGFloat)u {
    KBKey *k = [KBKey new];
    k.kind = kind; k.units = u; k.functional = YES;
    return k;
}
- (NSArray<NSString *> *)altsFor:(NSString *)c {
    static NSDictionary *m;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        m = @{
            @"a": @[@"a", @"à", @"á", @"â", @"ä", @"æ", @"ã", @"å"], @"e": @[@"e", @"è", @"é", @"ê", @"ë", @"ē"],
            @"i": @[@"i", @"î", @"ï", @"í", @"ì"], @"o": @[@"o", @"ô", @"ö", @"ò", @"ó", @"œ", @"ø", @"õ"],
            @"u": @[@"u", @"û", @"ü", @"ù", @"ú"], @"c": @[@"c", @"ç", @"ć", @"č"], @"n": @[@"n", @"ñ", @"ń"],
            @"s": @[@"s", @"ß", @"ś", @"š"], @"y": @[@"y", @"ÿ"], @"z": @[@"z", @"ž", @"ź", @"ż"], @"l": @[@"l", @"ł"],
            @"ا": @[@"ا", @"أ", @"إ", @"آ", @"ٱ"], @"ي": @[@"ي", @"ئ", @"ى"], @"و": @[@"و", @"ؤ"], @"ه": @[@"ه", @"ة"],
            @"ء": @[@"ء", @"أ", @"إ", @"ئ", @"ؤ", @"َ", @"ً", @"ُ", @"ٌ", @"ِ", @"ٍ", @"ّ", @"ْ"],
            @"ك": @[@"ك", @"گ"], @"ف": @[@"ف", @"ڤ"], @"ب": @[@"ب", @"پ"], @"ج": @[@"ج", @"چ"], @"ز": @[@"ز", @"ژ"], @"ل": @[@"ل", @"لا"],
            @"1": @[@"1", @"١", @"¹", @"½"], @"2": @[@"2", @"٢", @"²"], @"3": @[@"3", @"٣", @"³"], @"4": @[@"4", @"٤"], @"5": @[@"5", @"٥"],
            @"6": @[@"6", @"٦"], @"7": @[@"7", @"٧"], @"8": @[@"8", @"٨"], @"9": @[@"9", @"٩"], @"0": @[@"0", @"٠", @"°"],
            @"-": @[@"-", @"–", @"—", @"•"], @"$": @[@"$", @"€", @"£", @"¥", @"₩", @"₹"], @"'": @[@"'", @"‘", @"’", @"`"],
            @"\"": @[@"\"", @"“", @"”", @"«", @"»"], @".": @[@".", @"…"], @"?": @[@"?", @"¿"], @"!": @[@"!", @"¡"], @"&": @[@"&", @"§"],
            @"؟": @[@"؟", @"?"], @"،": @[@"،", @","], @"؛": @[@"؛", @";"]
        };
    });
    return m[c];
}

- (void)rebuildKeys {
    for (UIView *v in _keysView.subviews) [v removeFromSuperview];
    _globe = nil;
    _rows = [NSMutableArray array];
    NSMutableArray *r1 = [NSMutableArray array], *r2 = [NSMutableArray array], *r3 = [NSMutableArray array], *r4 = [NSMutableArray array];

    if (_page == KBPageLetters && !_arabic) {
        for (NSString *c in TJChars(@"qwertyuiop")) [r1 addObject:[self charKey:c units:1]];
        for (NSString *c in TJChars(@"asdfghjkl")) [r2 addObject:[self charKey:c units:1]];
        [r3 addObject:[self funcKey:KBKindShift units:0]];
        for (NSString *c in TJChars(@"zxcvbnm")) [r3 addObject:[self charKey:c units:1]];
        [r3 addObject:[self funcKey:KBKindDelete units:0]];
    } else if (_page == KBPageLetters) {
        for (NSString *c in TJChars(@"ضصثقفغعهخحج")) [r1 addObject:[self charKey:c units:1]];
        for (NSString *c in TJChars(@"شسيبلاتنمكة")) [r2 addObject:[self charKey:c units:1]];
        for (NSString *c in TJChars(@"ظطذدزروىء")) [r3 addObject:[self charKey:c units:1]];
        [r3 addObject:[self funcKey:KBKindDelete units:0]];
    } else {
        BOOL sym = _page == KBPageSymbols;
        NSString *a = sym ? @"[]{}#%^*+=" : @"1234567890";
        NSString *b = sym ? @"_\\|~<>€£¥•" : (_arabic ? @"-/:؛()$&@\"" : @"-/:;()$&@\"");
        NSString *c = _arabic ? @".،؟!'" : @".,?!'";
        for (NSString *x in TJChars(a)) [r1 addObject:[self charKey:x units:1]];
        for (NSString *x in TJChars(b)) [r2 addObject:[self charKey:x units:1]];
        KBKey *m = [self funcKey:KBKindMode units:0];
        m.target = sym ? KBPageNumbers : KBPageSymbols;
        [r3 addObject:m];
        for (NSString *x in TJChars(c)) [r3 addObject:[self charKey:x units:1.38]];
        [r3 addObject:[self funcKey:KBKindDelete units:0]];
    }

    KBKey *mode = [self funcKey:KBKindMode units:1.27];
    mode.target = _page == KBPageLetters ? KBPageNumbers : KBPageLetters;
    [r4 addObject:mode];
    if (_page == KBPageLetters) [r4 addObject:[self funcKey:KBKindLang units:1.27]];
    if (self.needsInputModeSwitchKey) {
        KBKey *placeholder = [self funcKey:KBKindLang units:1.27];
        placeholder.value = @"__globe__";
        [r4 addObject:placeholder];
    }
    KBKey *space = [self funcKey:KBKindSpace units:0];
    space.functional = NO;
    [r4 addObject:space];
    [r4 addObject:[self funcKey:KBKindReturn units:2.35]];

    [_rows addObjectsFromArray:@[r1, r2, r3, r4]];
    for (NSArray *row in _rows) {
        for (KBKey *k in row) {
            if ([k.value isEqualToString:@"__globe__"]) {
                _globe = [UIButton buttonWithType:UIButtonTypeSystem];
                [_globe setImage:[UIImage systemImageNamed:@"globe" withConfiguration:[UIImageSymbolConfiguration configurationWithPointSize:19]] forState:UIControlStateNormal];
                _globe.layer.cornerRadius = 8.5;
                [_globe addTarget:self action:@selector(handleInputModeListFromView:withEvent:) forControlEvents:UIControlEventAllTouchEvents];
                [_keysView addSubview:_globe];
                continue;
            }
            [_keysView addSubview:k];
        }
    }
    [self relabel];
    [self recolor];
    [self.view setNeedsLayout];
}

- (void)relabel {
    BOOL land = [self isLandscape];
    CGFloat charSize = _page == KBPageLetters ? (_arabic ? (land ? 20 : 22) : (land ? 20 : 25)) : (land ? 19 : 22);
    for (NSArray *row in _rows) {
        for (KBKey *k in row) {
            k.icon.image = nil;
            k.label.text = nil;
            UIImageSymbolConfiguration *cfg = [UIImageSymbolConfiguration configurationWithPointSize:land ? 16 : 19 weight:UIImageSymbolWeightRegular];
            switch (k.kind) {
                case KBKindChar: {
                    BOOL upper = _page == KBPageLetters && !_arabic && (_shift || _caps);
                    k.label.text = upper ? [k.value uppercaseString] : k.value;
                    k.label.font = [UIFont systemFontOfSize:charSize weight:UIFontWeightRegular];
                    break;
                }
                case KBKindShift: {
                    NSString *n = _caps ? @"capslock.fill" : (_shift ? @"shift.fill" : @"shift");
                    k.icon.image = [UIImage systemImageNamed:n withConfiguration:cfg];
                    k.functional = !(_shift || _caps);
                    break;
                }
                case KBKindDelete:
                    k.icon.image = [UIImage systemImageNamed:(k.pressed ? @"delete.left.fill" : @"delete.left") withConfiguration:cfg];
                    break;
                case KBKindMode:
                    k.label.font = [UIFont systemFontOfSize:land ? 15 : 16 weight:UIFontWeightRegular];
                    if (k.target == KBPageNumbers && _page == KBPageLetters) k.label.text = _arabic ? @"١٢٣" : @"123";
                    else if (k.target == KBPageLetters) k.label.text = _arabic ? @"أ ب ج" : @"ABC";
                    else if (k.target == KBPageSymbols) k.label.text = @"#+=";
                    else k.label.text = @"123";
                    break;
                case KBKindLang:
                    k.label.font = [UIFont systemFontOfSize:(_arabic ? 15 : 19) weight:UIFontWeightMedium];
                    k.label.text = _arabic ? @"EN" : @"ع";
                    break;
                case KBKindSpace:
                    k.label.font = [UIFont systemFontOfSize:land ? 14 : 15 weight:UIFontWeightRegular];
                    k.label.text = _arabic ? @"مسافة" : @"space";
                    break;
                case KBKindReturn:
                    break;
            }
        }
    }
    [self updateReturnKey];
}

- (void)updateReturnKey {
    KBKey *ret = nil;
    for (KBKey *k in _rows.lastObject) if (k.kind == KBKindReturn) ret = k;
    if (!ret) return;
    BOOL land = [self isLandscape];
    UIReturnKeyType t = self.textDocumentProxy.returnKeyType;
    ret.icon.image = nil; ret.label.text = nil;
    ret.label.font = [UIFont systemFontOfSize:land ? 15 : 16 weight:UIFontWeightRegular];
    UIImageSymbolConfiguration *cfg = [UIImageSymbolConfiguration configurationWithPointSize:land ? 16 : 19 weight:UIImageSymbolWeightRegular];
    NSString *ar = nil, *en = nil;
    switch (t) {
        case UIReturnKeySearch: case UIReturnKeyGoogle: case UIReturnKeyYahoo:
            ret.icon.image = [UIImage systemImageNamed:@"magnifyingglass" withConfiguration:cfg]; break;
        case UIReturnKeyGo: en = @"go"; ar = @"انتقال"; break;
        case UIReturnKeySend: en = @"send"; ar = @"إرسال"; break;
        case UIReturnKeyDone: en = @"done"; ar = @"تم"; break;
        case UIReturnKeyNext: en = @"next"; ar = @"التالي"; break;
        case UIReturnKeyJoin: en = @"join"; ar = @"انضمام"; break;
        case UIReturnKeyRoute: en = @"route"; ar = @"مسار"; break;
        case UIReturnKeyContinue: en = @"continue"; ar = @"متابعة"; break;
        case UIReturnKeyEmergencyCall: en = @"SOS"; ar = @"طوارئ"; break;
        default:
            ret.icon.image = [UIImage systemImageNamed:@"return" withConfiguration:cfg] ?: [UIImage systemImageNamed:@"arrow.turn.down.left" withConfiguration:cfg];
            break;
    }
    if (en) ret.label.text = _arabic ? ar : en;
    [self paintKey:ret];
}

- (BOOL)returnIsBlue {
    id<UITextDocumentProxy> px = self.textDocumentProxy;
    UIReturnKeyType t = px.returnKeyType;
    if (t == UIReturnKeyDefault || t == UIReturnKeyNext) return NO;
    if (px.enablesReturnKeyAutomatically && !px.hasText) return NO;
    return YES;
}

#pragma mark Layout

- (void)viewDidLayoutSubviews {
    [super viewDidLayoutSubviews];
    CGFloat W = self.view.bounds.size.width, H = self.view.bounds.size.height;
    CGFloat barH = [self barHeight];
    _bar.frame = CGRectMake(0, 0, W, barH);
    _keysView.frame = CGRectMake(0, barH, W, MAX(0, H - barH));
    if ([self isLandscape] != _lastLand) { _lastLand = [self isLandscape]; _heightC.constant = [self desiredHeight]; [self relabel]; }
    [self layoutBar];
    [self layoutKeys];
}

- (void)layoutKeys {
    CGFloat W = _keysView.bounds.size.width;
    if (W <= 0) return;
    BOOL land = [self isLandscape];
    CGFloat pad = land ? 4 : 3, gap = land ? 6 : 6, kh = [self keyHeight], vg = [self rowGap];
    CGFloat avail = W - 2 * pad;
    CGFloat w10 = (avail - 9 * gap) / 10;
    CGFloat radius = land ? 6.5 : 8.5;
    for (NSUInteger r = 0; r < _rows.count; r++) {
        NSArray<KBKey *> *row = _rows[r];
        NSUInteger maxChars = MAX(MAX([_rows[0] count], [_rows[1] count]), 10u);
        CGFloat uw = (r == 3) ? w10 : (avail - (maxChars - 1) * gap) / maxChars;
        CGFloat fixed = 0; NSUInteger flex = 0;
        for (KBKey *k in row) { if (k.units > 0) fixed += k.units * uw; else flex++; }
        fixed += (row.count - 1) * gap;
        CGFloat flexW = flex ? MAX(uw, (avail - fixed) / flex) : 0;
        CGFloat x = pad + (flex ? 0 : (avail - fixed) / 2);
        CGFloat y = 6 + r * (kh + vg);
        for (KBKey *k in row) {
            CGFloat w = k.units > 0 ? k.units * uw : flexW;
            CGRect f = CGRectMake(round(x), y, round(w), kh);
            if ([k.value isEqualToString:@"__globe__"]) { _globe.frame = f; _globe.layer.cornerRadius = radius; }
            else { k.frame = f; k.layer.cornerRadius = radius; [k setNeedsLayout]; }
            x += w + gap;
        }
    }
}

- (void)layoutBar {
    CGFloat W = _bar.bounds.size.width, H = _bar.bounds.size.height;
    [_trBtn sizeToFit];
    CGFloat bw = MIN(_trBtn.bounds.size.width + 4, W * 0.55), bh = 30;
    _trBtn.frame = CGRectMake(W - bw - 8, (H - bh) / 2, bw, bh);
    [_undoBtn sizeToFit];
    CGFloat uw = _undoBtn.bounds.size.width + 12;
    _undoBtn.frame = CGRectMake(CGRectGetMinX(_trBtn.frame) - uw - 4, (H - bh) / 2, uw, bh);
    CGFloat right = _undoBtn.hidden ? CGRectGetMinX(_trBtn.frame) - 8 : CGRectGetMinX(_undoBtn.frame) - 4;
    _spin.center = CGPointMake(right - 12, H / 2);
    CGFloat sr = _spin.isAnimating ? right - 28 : right;
    _status.frame = CGRectMake(10, 0, MAX(0, sr - 10), H);
}

#pragma mark Touch handling

- (KBKey *)keyAt:(CGPoint)p {
    KBKey *best = nil; CGFloat bestD = CGFLOAT_MAX;
    for (NSArray *row in _rows) for (KBKey *k in row) {
        if ([k.value isEqualToString:@"__globe__"]) continue;
        CGRect f = k.frame;
        CGFloat dx = MAX(0, MAX(CGRectGetMinX(f) - p.x, p.x - CGRectGetMaxX(f)));
        CGFloat dy = MAX(0, MAX(CGRectGetMinY(f) - p.y, p.y - CGRectGetMaxY(f)));
        CGFloat d = dx * dx + dy * dy * 1.5;
        if (d < bestD) { bestD = d; best = k; }
    }
    return bestD < 900 ? best : nil;
}

- (void)setPressed:(KBKey *)k on:(BOOL)on {
    if (!k || k.pressed == on) return;
    k.pressed = on;
    if (k.kind == KBKindDelete) {
        UIImageSymbolConfiguration *cfg = [UIImageSymbolConfiguration configurationWithPointSize:[self isLandscape] ? 16 : 19];
        k.icon.image = [UIImage systemImageNamed:(on ? @"delete.left.fill" : @"delete.left") withConfiguration:cfg];
    }
    BOOL showsPopup = k.kind == KBKindChar && ![self isLandscape];
    if (!(showsPopup && on)) [self paintKey:k];
}

- (void)showPopupFor:(KBKey *)k {
    if (k.kind != KBKindChar || [self isLandscape]) { _popup.hidden = YES; return; }
    CGRect f = [_keysView convertRect:k.frame toView:self.view];
    CGFloat w = MAX(f.size.width + 16, 44), h = f.size.height + 12;
    CGFloat x = MIN(MAX(2, CGRectGetMidX(f) - w / 2), self.view.bounds.size.width - w - 2);
    CGFloat y = MAX(0, CGRectGetMinY(f) - h - 2);
    _popup.frame = CGRectMake(x, y, w, h);
    _popupLabel.frame = _popup.bounds;
    _popupLabel.font = [UIFont systemFontOfSize:(_arabic && _page == KBPageLetters) ? 32 : 34 weight:UIFontWeightRegular];
    _popupLabel.text = k.label.text;
    _popup.hidden = NO;
    [self.view bringSubviewToFront:_popup];
}

- (void)keysTouchesBegan:(NSSet<UITouch *> *)touches {
    for (UITouch *t in touches) {
        CGPoint p = [t locationInView:_keysView];
        KBKey *k = [self keyAt:p];
        if (!k) continue;
        // a new touch commits any other char key still held (fast typing rollover)
        for (NSValue *other in _touches.allKeys.copy) {
            KBTouch *o = _touches[other];
            if (o.key.kind == KBKindChar && !o.longMode) { [self fire:o.key]; [o.timer invalidate]; [self setPressed:o.key on:NO]; [_touches removeObjectForKey:other]; _popup.hidden = YES; }
        }
        KBTouch *st = [KBTouch new];
        st.key = k; st.start = p; st.lastX = p.x;
        _touches[[NSValue valueWithNonretainedObject:t]] = st;
        [self setPressed:k on:YES];
        [[UIDevice currentDevice] playInputClick];
        [self showPopupFor:k];
        if (k.kind == KBKindDelete) {
            [self fire:k];
            __weak typeof(self) ws = self;
            st.timer = [NSTimer scheduledTimerWithTimeInterval:0.45 repeats:NO block:^(NSTimer *tm) { [ws startDeleteRepeat:st]; }];
        } else if (k.kind == KBKindSpace || (k.kind == KBKindChar && k.alts.count > 1)) {
            __weak typeof(self) ws = self;
            st.timer = [NSTimer scheduledTimerWithTimeInterval:0.42 repeats:NO block:^(NSTimer *tm) { [ws longPress:st]; }];
        }
    }
}

- (void)keysTouchesMoved:(NSSet<UITouch *> *)touches {
    for (UITouch *t in touches) {
        KBTouch *st = _touches[[NSValue valueWithNonretainedObject:t]];
        if (!st) continue;
        CGPoint p = [t locationInView:_keysView];
        if (st.longMode && st.key.kind == KBKindSpace) {
            CGFloat dx = p.x - st.lastX, step = 9;
            while (fabs(dx) >= step) {
                NSInteger dir = dx > 0 ? 1 : -1;
                [self.textDocumentProxy adjustTextPositionByCharacterOffset:dir];
                st.lastX += dir * step; dx = p.x - st.lastX;
            }
            continue;
        }
        if (st.longMode && st.key.kind == KBKindChar) { [self updateAltSelection:[t locationInView:self.view].x]; continue; }
        if (st.key.kind == KBKindChar) {
            KBKey *nk = [self keyAt:p];
            if (nk && nk != st.key && nk.kind == KBKindChar) {
                [st.timer invalidate];
                [self setPressed:st.key on:NO];
                st.key = nk;
                [self setPressed:nk on:YES];
                [self showPopupFor:nk];
                if (nk.alts.count > 1) {
                    __weak typeof(self) ws = self;
                    st.timer = [NSTimer scheduledTimerWithTimeInterval:0.42 repeats:NO block:^(NSTimer *tm) { [ws longPress:st]; }];
                }
            }
        }
    }
}

- (void)keysTouchesEnded:(NSSet<UITouch *> *)touches cancelled:(BOOL)cancelled {
    for (UITouch *t in touches) {
        NSValue *kv = [NSValue valueWithNonretainedObject:t];
        KBTouch *st = _touches[kv];
        if (!st) continue;
        [_touches removeObjectForKey:kv];
        [st.timer invalidate];
        KBKey *k = st.key;
        if (st.longMode && k.kind == KBKindChar) {
            if (!cancelled && st.altIndex >= 0 && st.altIndex < (NSInteger)k.alts.count) [self insertChar:k.alts[st.altIndex]];
            _altPopup.hidden = YES;
        } else if (st.longMode && k.kind == KBKindSpace) {
            [self setCursorMode:NO];
        } else if (k.kind != KBKindDelete && !cancelled) {
            [self fire:k];
        }
        [self setPressed:k on:NO];
        _popup.hidden = YES;
    }
}

- (void)startDeleteRepeat:(KBTouch *)st {
    st.longMode = YES;
    __weak typeof(self) ws = self;
    st.timer = [NSTimer scheduledTimerWithTimeInterval:0.085 repeats:YES block:^(NSTimer *tm) {
        st.repeats++;
        if (st.repeats > 22) {
            if (st.repeats % 2 == 0) [ws deleteWord];
        } else {
            [ws.textDocumentProxy deleteBackward];
        }
        [[UIDevice currentDevice] playInputClick];
        [ws afterEdit];
    }];
}

- (void)longPress:(KBTouch *)st {
    st.longMode = YES;
    if (st.key.kind == KBKindSpace) { [self setCursorMode:YES]; return; }
    _popup.hidden = YES;
    [self showAltsFor:st];
}

- (void)setCursorMode:(BOOL)on {
    _cursorMode = on;
    [UIView animateWithDuration:0.15 animations:^{
        for (NSArray *row in self->_rows) for (KBKey *k in row) { k.label.alpha = on ? 0 : 1; k.icon.alpha = on ? 0 : 1; }
    }];
}

- (void)showAltsFor:(KBTouch *)st {
    KBKey *k = st.key;
    NSArray *alts = k.alts;
    for (UILabel *l in _altLabels) [l removeFromSuperview];
    [_altLabels removeAllObjects];
    CGRect f = [_keysView convertRect:k.frame toView:self.view];
    CGFloat cw = MAX(f.size.width, 34), ch = f.size.height + 8;
    CGFloat total = cw * alts.count + 8;
    CGFloat W = self.view.bounds.size.width;
    _altLeftwards = CGRectGetMidX(f) > W / 2;
    CGFloat x = _altLeftwards ? CGRectGetMaxX(f) + 4 - total : CGRectGetMinX(f) - 4;
    x = MIN(MAX(2, x), W - total - 2);
    CGFloat y = MAX(0, CGRectGetMinY(f) - ch - 10);
    _altPopup.frame = CGRectMake(x, y, total, ch + 8);
    _altCellW = cw; _altStartX = x + 4;
    for (NSUInteger i = 0; i < alts.count; i++) {
        NSUInteger slot = _altLeftwards ? alts.count - 1 - i : i;
        UILabel *l = [[UILabel alloc] initWithFrame:CGRectMake(4 + slot * cw, 4, cw, ch)];
        BOOL upper = _page == KBPageLetters && !_arabic && (_shift || _caps);
        l.text = upper ? [alts[i] uppercaseString] : alts[i];
        l.textAlignment = NSTextAlignmentCenter;
        l.font = [UIFont systemFontOfSize:26];
        l.layer.cornerRadius = 7;
        l.layer.masksToBounds = YES;
        [_altPopup addSubview:l];
        [_altLabels addObject:l];
    }
    _altPopup.hidden = NO;
    [self.view bringSubviewToFront:_altPopup];
    st.altIndex = 0;
    [self paintAlts:0];
}

- (void)updateAltSelection:(CGFloat)x {
    KBTouch *st = nil;
    for (KBTouch *o in _touches.allValues) if (o.longMode && o.key.kind == KBKindChar) st = o;
    if (!st) return;
    NSInteger slot = (NSInteger)floor((x - _altStartX) / _altCellW);
    NSInteger n = (NSInteger)st.key.alts.count;
    slot = MAX(0, MIN(n - 1, slot));
    NSInteger idx = _altLeftwards ? n - 1 - slot : slot;
    if (idx != st.altIndex) { st.altIndex = idx; [self paintAlts:idx]; }
}

- (void)paintAlts:(NSInteger)sel {
    for (NSUInteger i = 0; i < _altLabels.count; i++) {
        UILabel *l = _altLabels[i];
        BOOL on = (NSInteger)i == sel;
        l.backgroundColor = on ? [UIColor systemBlueColor] : [UIColor clearColor];
        l.textColor = on ? [UIColor whiteColor] : [self textColor];
    }
}

#pragma mark Actions

- (void)fire:(KBKey *)k {
    switch (k.kind) {
        case KBKindChar: [self insertChar:k.value]; break;
        case KBKindShift: [self shiftTapped]; break;
        case KBKindDelete: [self.textDocumentProxy deleteBackward]; [self afterEdit]; [self updateShift]; break;
        case KBKindMode: _page = k.target; [self rebuildKeys]; [self updateShift]; break;
        case KBKindLang:
            _arabic = !_arabic;
            [[NSUserDefaults standardUserDefaults] setBool:_arabic forKey:@"kb.arabic"];
            _page = KBPageLetters; _caps = NO;
            [self rebuildKeys]; [self updateShift];
            break;
        case KBKindSpace: [self spaceTapped]; break;
        case KBKindReturn: [self.textDocumentProxy insertText:@"\n"]; [self afterEdit]; [self updateShift]; break;
    }
}

- (void)insertChar:(NSString *)s {
    BOOL upper = _page == KBPageLetters && !_arabic && (_shift || _caps);
    [self.textDocumentProxy insertText:upper ? [s uppercaseString] : s];
    if (_shift && !_caps) { _shift = NO; [self relabel]; [self recolor]; }
    if (_page != KBPageLetters && [s isEqualToString:@"'"]) { _page = KBPageLetters; [self rebuildKeys]; }
    [self afterEdit];
}

- (void)shiftTapped {
    NSTimeInterval now = CACurrentMediaTime();
    if (_caps) { _caps = NO; _shift = NO; }
    else if (_shift && now - _lastShiftTap < 0.35) { _caps = YES; _shift = YES; }
    else _shift = !_shift;
    _lastShiftTap = now;
    [self relabel]; [self recolor];
}

- (void)spaceTapped {
    id<UITextDocumentProxy> px = self.textDocumentProxy;
    NSString *ctx = px.documentContextBeforeInput ?: @"";
    NSTimeInterval now = CACurrentMediaTime();
    if (now - _lastSpaceTap < 0.45 && ctx.length >= 2 && [ctx hasSuffix:@" "]) {
        unichar c = [ctx characterAtIndex:ctx.length - 2];
        if ([[NSCharacterSet alphanumericCharacterSet] characterIsMember:c]) {
            [px deleteBackward];
            [px insertText:@". "];
            _lastSpaceTap = 0;
            [self afterEdit]; [self updateShift];
            return;
        }
    }
    [px insertText:@" "];
    _lastSpaceTap = now;
    if (_page != KBPageLetters) { _page = KBPageLetters; [self rebuildKeys]; }
    [self afterEdit]; [self updateShift];
}

- (void)deleteWord {
    id<UITextDocumentProxy> px = self.textDocumentProxy;
    NSString *ctx = px.documentContextBeforeInput ?: @"";
    if (!ctx.length) { [px deleteBackward]; return; }
    NSCharacterSet *ws = [NSCharacterSet whitespaceAndNewlineCharacterSet];
    NSInteger i = ctx.length;
    while (i > 0 && [ws characterIsMember:[ctx characterAtIndex:i - 1]]) i--;
    while (i > 0 && ![ws characterIsMember:[ctx characterAtIndex:i - 1]]) i--;
    NSUInteger n = MAX((NSUInteger)1, TJComposedCount([ctx substringFromIndex:i]));
    for (NSUInteger k = 0; k < n; k++) [px deleteBackward];
}

- (void)updateShift {
    if (_caps) return;
    BOOL want = NO;
    if (_page == KBPageLetters && !_arabic) {
        id<UITextDocumentProxy> px = self.textDocumentProxy;
        UITextAutocapitalizationType t = px.autocapitalizationType;
        if (t == UITextAutocapitalizationTypeAllCharacters) want = YES;
        else if (t == UITextAutocapitalizationTypeSentences || t == UITextAutocapitalizationTypeWords) {
            NSString *ctx = px.documentContextBeforeInput ?: @"";
            NSString *tr = [ctx stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@" "]];
            if (!tr.length) want = YES;
            else {
                unichar last = [ctx characterAtIndex:ctx.length - 1];
                unichar lt = [tr characterAtIndex:tr.length - 1];
                if (last == '\n' || lt == '\n') want = YES;
                else if (t == UITextAutocapitalizationTypeWords && last == ' ') want = YES;
                else if (last == ' ' && (lt == '.' || lt == '!' || lt == '?')) want = YES;
            }
        }
    }
    if (want != _shift) { _shift = want; [self relabel]; [self recolor]; }
}

- (void)afterEdit {
    if (_undo) { _undo = nil; _undoBtn.hidden = YES; }
    [self updateBar];
}

#pragma mark Translate bar

- (NSString *)currentSegment {
    NSString *ctx = self.textDocumentProxy.documentContextBeforeInput ?: @"";
    NSRange nl = [ctx rangeOfString:@"\n" options:NSBackwardsSearch];
    return nl.location == NSNotFound ? ctx : [ctx substringFromIndex:nl.location + 1];
}

- (BOOL)isArabicText:(NSString *)s {
    NSUInteger ar = 0, en = 0;
    for (NSUInteger i = 0; i < s.length; i++) {
        unichar c = [s characterAtIndex:i];
        if (TJIsArabicChar(c)) ar++;
        else if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) en++;
    }
    if (!ar && !en) return _arabic;
    return ar >= en;
}

- (void)setStatus:(NSString *)s {
    BOOL brand = [s isEqualToString:@"ترجمان"];
    _status.text = s;
    _status.textAlignment = brand ? NSTextAlignmentLeft : NSTextAlignmentRight;
    _status.font = brand ? [UIFont systemFontOfSize:15 weight:UIFontWeightBold] : [UIFont systemFontOfSize:13 weight:UIFontWeightSemibold];
    _status.alpha = brand ? 0.55 : 1;
    [self layoutBar];
}

- (void)updateBar {
    NSString *seg = [[self currentSegment] stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    BOOL toEN = seg.length ? [self isArabicText:seg] : _arabic;
    NSString *title = toEN ? @"ترجم إلى English" : @"ترجم إلى العربي";
    [_trBtn setTitle:title forState:UIControlStateNormal];
    [_trBtn setImage:[UIImage systemImageNamed:@"character.bubble" withConfiguration:[UIImageSymbolConfiguration configurationWithPointSize:13 weight:UIImageSymbolWeightSemibold]] forState:UIControlStateNormal];
    _trBtn.semanticContentAttribute = UISemanticContentAttributeForceRightToLeft;
    _trBtn.imageEdgeInsets = UIEdgeInsetsMake(0, 6, 0, -6);
    BOOL enabled = seg.length > 0;
    UIColor *acc = [self accent];
    _trBtn.backgroundColor = enabled ? acc : [acc colorWithAlphaComponent:_dark ? 0.25 : 0.18];
    UIColor *fg = enabled ? (_dark ? [UIColor colorWithRed:0.05 green:0.06 blue:0.12 alpha:1] : [UIColor whiteColor]) : acc;
    [_trBtn setTitleColor:fg forState:UIControlStateNormal];
    _trBtn.tintColor = fg;
    if (!_spin.isAnimating && !_undo) [self setStatus:@"ترجمان"];
    [self layoutBar];
}

- (void)translateTapped {
    [[UIDevice currentDevice] playInputClick];
    if (!self.hasFullAccess) {
        [self setStatus:@"للترجمة فعّل «السماح بالوصول الكامل» من الإعدادات ← لوحات المفاتيح ← ترجمان"];
        return;
    }
    NSString *seg = [self currentSegment];
    NSString *core = [seg stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    if (!core.length) { [self setStatus:@"اكتب نص أولًا، بعدين اضغط ترجم"]; return; }
    if (core.length > 1500) { [self setStatus:@"النص طويل. ترجم جزء أقصر"]; return; }
    BOOL toEN = [self isArabicText:core];
    NSString *sl = toEN ? @"ar" : @"en", *tl = toEN ? @"en" : @"ar";
    NSUInteger req = ++_req;
    [_spin startAnimating];
    [self setStatus:@"جارٍ الترجمة…"];
    NSCharacterSet *allowed = [NSCharacterSet URLQueryAllowedCharacterSet].mutableCopy;
    [(NSMutableCharacterSet *)allowed removeCharactersInString:@"&=+?#"];
    NSString *q = [core stringByAddingPercentEncodingWithAllowedCharacters:allowed];
    NSString *us = [NSString stringWithFormat:@"https://translate.googleapis.com/translate_a/single?client=gtx&dj=1&ie=UTF-8&oe=UTF-8&dt=t&sl=%@&tl=%@&q=%@", sl, tl, q];
    NSURL *url = [NSURL URLWithString:us];
    __weak typeof(self) ws = self;
    [[_session dataTaskWithURL:url completionHandler:^(NSData *data, NSURLResponse *resp, NSError *error) {
        NSString *out = nil;
        if (!error && data) {
            id j = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
            if ([j isKindOfClass:[NSDictionary class]]) {
                NSMutableString *m = [NSMutableString string];
                for (id s in j[@"sentences"] ?: @[]) {
                    if ([s isKindOfClass:[NSDictionary class]] && [s[@"trans"] isKindOfClass:[NSString class]]) [m appendString:s[@"trans"]];
                }
                if (m.length) out = m;
            }
        }
        dispatch_async(dispatch_get_main_queue(), ^{ [ws finishTranslation:out segment:seg core:core toEN:toEN req:req]; });
    }] resume];
}

- (void)finishTranslation:(NSString *)out segment:(NSString *)seg core:(NSString *)core toEN:(BOOL)toEN req:(NSUInteger)req {
    if (req != _req) return;
    [_spin stopAnimating];
    if (!out.length) { [self setStatus:@"تعذر الاتصال بخدمة الترجمة. تأكد من الإنترنت"]; return; }
    NSString *now = [self currentSegment];
    if (![now isEqualToString:seg]) { [self setStatus:@"تغيّر النص. اضغط ترجم مرة ثانية"]; return; }
    NSRange coreR = [seg rangeOfString:core];
    NSString *lead = coreR.location == NSNotFound ? @"" : [seg substringToIndex:coreR.location];
    NSString *trail = coreR.location == NSNotFound ? @"" : [seg substringFromIndex:NSMaxRange(coreR)];
    NSString *replacement = [NSString stringWithFormat:@"%@%@%@", lead, out, trail];
    [self replaceTail:seg with:replacement];
    _undo = @{ @"inserted": replacement, @"original": seg };
    _undoBtn.hidden = NO;
    [self setStatus:toEN ? @"تُرجم إلى English" : @"تُرجم إلى العربي"];
    [self updateShift];
}

// Delete `old` (which sits right before the cursor) and insert `neu`.
- (void)replaceTail:(NSString *)old with:(NSString *)neu {
    id<UITextDocumentProxy> px = self.textDocumentProxy;
    NSString *remaining = old;
    NSUInteger guard = 0, maxSteps = old.length + 32;
    while (remaining.length && guard++ < maxSteps) {
        NSString *before = px.documentContextBeforeInput ?: @"";
        [px deleteBackward];
        NSString *after = px.documentContextBeforeInput ?: @"";
        if ([after isEqualToString:before]) {          // host did not report the change: delete the rest by count
            NSUInteger n = TJComposedCount(remaining);
            for (NSUInteger k = 1; k < n; k++) [px deleteBackward];
            remaining = @"";
            break;
        }
        NSUInteger keep = 0;
        for (NSUInteger k = MIN(remaining.length - 1, after.length); k > 0; k--) {
            if ([after hasSuffix:[remaining substringToIndex:k]]) { keep = k; break; }
        }
        remaining = [remaining substringToIndex:keep];
    }
    [px insertText:neu];
}

- (void)undoTapped {
    if (!_undo) return;
    NSDictionary *u = _undo;
    _undo = nil;
    _undoBtn.hidden = YES;
    NSString *ctx = [self currentSegment];
    if ([ctx hasSuffix:u[@"inserted"]]) {
        [self replaceTail:u[@"inserted"] with:u[@"original"]];
        [self setStatus:@"رجع النص الأصلي"];
    } else {
        [self setStatus:@"ما أقدر أتراجع بعد ما تغيّر النص"];
    }
    [self updateShift];
}

@end
