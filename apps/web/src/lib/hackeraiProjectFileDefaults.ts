import {
  HACKERAI_PROJECT_FILE_NAME,
  type EnvironmentId,
  type HackerAIProjectFile,
} from "@hackerai/contracts";
import { parseHackerAIProjectFile } from "@hackerai/shared/hackeraiProjectFile";
import { executeAtomQuery } from "@hackerai/client-runtime/state/runtime";

import {
  getProjectFileQueryAtom,
  resolveProjectFileQueryData,
} from "~/components/files/projectFilesQueryState";
import { appAtomRegistry } from "~/rpc/atomRegistry";

export async function readHackerAIProjectFile(
  environmentId: EnvironmentId,
  workspaceRoot: string,
): Promise<HackerAIProjectFile | null> {
  const result = await executeAtomQuery(
    appAtomRegistry,
    getProjectFileQueryAtom(environmentId, workspaceRoot, HACKERAI_PROJECT_FILE_NAME),
    { reportDefect: false, reportFailure: false },
  );
  const data = resolveProjectFileQueryData(
    environmentId,
    workspaceRoot,
    HACKERAI_PROJECT_FILE_NAME,
    result._tag === "Success" ? result.value : null,
  );
  if (data === null || data.exists === false || data.truncated) return null;
  return parseHackerAIProjectFile(data.contents);
}
