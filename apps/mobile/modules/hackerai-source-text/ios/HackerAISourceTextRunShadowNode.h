#pragma once

#include <react/renderer/components/HackerAISourceTextSpec/EventEmitters.h>
#include <react/renderer/components/HackerAISourceTextSpec/Props.h>
#include <react/renderer/components/HackerAISourceTextSpec/States.h>
#include <react/renderer/components/view/ConcreteViewShadowNode.h>

namespace facebook::react {
extern const char HackerAISourceTextRunComponentName[];

using HackerAISourceTextRunShadowNode =
    ConcreteViewShadowNode<HackerAISourceTextRunComponentName, HackerAISourceTextRunProps,
                           HackerAISourceTextRunEventEmitter, HackerAISourceTextRunState>;
} // namespace facebook::react
