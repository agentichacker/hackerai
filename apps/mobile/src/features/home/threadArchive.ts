import {
  threadRuntimeCanArchive,
  type ThreadRuntimeSummary,
} from "@hackerai/client-runtime/state/models";

export function threadCanArchive(runtime: ThreadRuntimeSummary | null | undefined): boolean {
  return threadRuntimeCanArchive(runtime);
}
