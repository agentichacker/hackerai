#import <React/RCTUIManager.h>
#import <React/RCTViewManager.h>

@interface HackerAISourceTextManager : RCTViewManager
@end

@implementation HackerAISourceTextManager

RCT_EXPORT_MODULE(HackerAISourceText)

- (UIView *)view {
  return [[UIView alloc] init];
}

@end

@interface HackerAISourceTextRunManager : RCTViewManager
@end

@implementation HackerAISourceTextRunManager

RCT_EXPORT_MODULE(HackerAISourceTextRun)

- (UIView *)view {
  return nil;
}

@end
