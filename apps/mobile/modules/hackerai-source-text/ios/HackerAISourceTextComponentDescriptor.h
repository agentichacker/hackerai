#pragma once

#include "HackerAISourceTextShadowNode.h"

#include <react/renderer/componentregistry/ComponentDescriptorProviderRegistry.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>

namespace facebook::react {
using HackerAISourceTextComponentDescriptor =
    ConcreteComponentDescriptor<HackerAISourceTextShadowNode>;

void HackerAISourceTextSpec_registerComponentDescriptorsFromCodegen(
    std::shared_ptr<const ComponentDescriptorProviderRegistry> registry);
} // namespace facebook::react
