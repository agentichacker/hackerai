#pragma once

#include "HybridHackerAIHighlightsSpec.hpp"

namespace margelo::nitro::hackeraiHighlights {

class HybridHackerAIHighlights : public HybridHackerAIHighlightsSpec {
public:
  HybridHackerAIHighlights() : HybridObject(TAG) {}

  std::optional<std::shared_ptr<ArrayBuffer>> tokenize(SourceText source,
                                                       double language) override;
};

} // namespace margelo::nitro::hackeraiHighlights
