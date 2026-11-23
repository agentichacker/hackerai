#pragma once

#include "HackerAISourceTextRunShadowNode.h"

#include <react/renderer/componentregistry/ComponentDescriptorProviderRegistry.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>

namespace facebook::react {
using HackerAISourceTextRunComponentDescriptor =
    ConcreteComponentDescriptor<HackerAISourceTextRunShadowNode>;

void HackerAISourceTextRunSpec_registerComponentDescriptorsFromCodegen(
    std::shared_ptr<const ComponentDescriptorProviderRegistry> registry);
} // namespace facebook::react
