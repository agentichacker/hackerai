import type { PullRequestChangeBreakdown } from "@hackerai/contracts";
import { summarizeChangedFiles } from "@hackerai/shared/changedFileKind";
import type { ProviderFileStats } from "@hackerai/source-control-core/server/PullRequestProvider";

export function toChangeBreakdown(stats: ProviderFileStats): PullRequestChangeBreakdown {
  if (stats.truncated) return null;
  return summarizeChangedFiles(stats.files);
}
