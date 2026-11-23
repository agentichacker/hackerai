import type { UsageProviderKind } from "@hackerai/contracts";
import type { TranscriptUsageFormat } from "@hackerai/provider-core/server/usage";
import { piUsageFormat } from "@hackerai/provider-pi/server/usage";
import { grokUsageFormat } from "@hackerai/provider-grok/server/usage";
import { museUsageFormat } from "@hackerai/provider-muse/server/usage";

import { claudeUsageFormat } from "../provider/Drivers/claudeUsage.ts";
import { codexUsageFormat } from "../provider/Drivers/codexUsage.ts";

export const TEST_FORMATS: Record<
  "claude" | "codex" | "grok" | "pi" | "muse",
  TranscriptUsageFormat<unknown>
> = {
  claude: claudeUsageFormat,
  codex: codexUsageFormat,
  grok: grokUsageFormat,
  pi: piUsageFormat,
  muse: museUsageFormat,
};

export const TEST_FORMAT_MAP = new Map<UsageProviderKind, TranscriptUsageFormat<unknown>>(
  Object.entries(TEST_FORMATS) as Array<[UsageProviderKind, TranscriptUsageFormat<unknown>]>,
);
