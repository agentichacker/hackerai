#import "HackerAISourceTextRun.h"
#import <React/RCTFabricComponentsPlugins.h>
#import "HackerAISourceTextRunComponentDescriptor.h"
#import <react/renderer/components/HackerAISourceTextSpec/Props.h>
#import <react/renderer/components/HackerAISourceTextSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

@interface HackerAISourceTextRun () <RCTT3SourceTextRunViewProtocol>

@end

@implementation HackerAISourceTextRun {
  NSString *_text;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<
      HackerAISourceTextRunComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps =
        std::make_shared<const HackerAISourceTextRunProps>();
    _props = defaultProps;
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props
           oldProps:(Props::Shared const &)oldProps {
  const auto &oldViewProps =
      *std::static_pointer_cast<HackerAISourceTextRunProps const>(_props);
  const auto &newViewProps =
      *std::static_pointer_cast<HackerAISourceTextRunProps const>(props);

  if (newViewProps.text != oldViewProps.text) {
    NSString *text = [NSString stringWithUTF8String:newViewProps.text.c_str()];
    _text = text;
  }

  [super updateProps:props oldProps:oldProps];
}

+ (BOOL)shouldBeRecycled {
  return NO;
}

Class<RCTComponentViewProtocol> HackerAISourceTextRunCls(void) {
  return HackerAISourceTextRun.class;
}

@end
