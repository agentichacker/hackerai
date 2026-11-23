import {
  HACKERAI_PROJECT_FILE_NAME,
  type EnvironmentId,
  type HackerAIProjectFile,
  type HackerAIProjectFileScript,
} from "@hackerai/contracts";
import { parseHackerAIProjectFile } from "@hackerai/shared/hackeraiProjectFile";

import { useProjectFileQuery } from "~/components/files/projectFilesQueryState";

const NO_SCRIPTS: ReadonlyArray<HackerAIProjectFileScript> = [];

export interface HackerAIProjectFileState {
  status: "loading" | "missing" | "invalid" | "valid";
  file: HackerAIProjectFile | null;
  scripts: ReadonlyArray<HackerAIProjectFileScript>;
}

export function useHackerAIProjectFileState(
  environmentId: EnvironmentId,
  cwd: string | null,
): HackerAIProjectFileState {
  const query = useProjectFileQuery(environmentId, cwd ?? "", HACKERAI_PROJECT_FILE_NAME, cwd !== null);
  const contents = query.data && !query.data.truncated ? query.data.contents : null;
  const isPending = query.isPending;
  if (contents === null) {
    return {
      status: isPending ? "loading" : "missing",
      file: null,
      scripts: NO_SCRIPTS,
    } as const;
  }
  const file = parseHackerAIProjectFile(contents);
  if (file === null) {
    return { status: "invalid", file: null, scripts: NO_SCRIPTS } as const;
  }
  return { status: "valid", file, scripts: file.scripts ?? NO_SCRIPTS } as const;
}

export function useHackerAIProjectFileScripts(
  environmentId: EnvironmentId,
  cwd: string | null,
): ReadonlyArray<HackerAIProjectFileScript> {
  return useHackerAIProjectFileState(environmentId, cwd).scripts;
}
