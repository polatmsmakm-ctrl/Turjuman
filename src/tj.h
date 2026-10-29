// Shared declarations for the Turjuman native shell.
#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>

typedef void (^TJOk)(id data);
typedef void (^TJFail)(NSString *code, NSString *msg);

@interface TJSpeech : NSObject
@property (nonatomic, copy) void (^emit)(NSString *name, NSDictionary *data);
@property (nonatomic, copy) void (^beforeStart)(void);
@property (nonatomic, copy) void (^afterStop)(void);
@property (nonatomic, readonly) BOOL listening;
- (void)startWithOptions:(NSDictionary *)o completion:(void (^)(NSString *err))done;
- (void)stop;
- (void)cancel;
@end

@interface TJViewController : UIViewController
- (void)emit:(NSString *)name data:(NSDictionary *)data;
- (void)usePlaybackSession;
- (void)handleLaunchAction:(NSDictionary *)action;
@end

// media.m: camera, OCR, pickers, transcription, documents, sharing, recording
@interface TJViewController (Media)
- (BOOL)handleMediaCommand:(NSString *)cmd args:(NSDictionary *)a ok:(TJOk)ok fail:(TJFail)fail;
@end
