import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";

import { HackerAIProjectFile, HACKERAI_PROJECT_FILE_SCHEMA_URL } from "@hackerai/contracts";

import { fromLenientJson } from "./schemaJson.ts";

export const HackerAIProjectFileFromJson = fromLenientJson(HackerAIProjectFile);

const decodeHackerAIProjectFile = Schema.decodeExit(HackerAIProjectFileFromJson);

export function parseHackerAIProjectFile(contents: string): HackerAIProjectFile | null {
  const decoded = decodeHackerAIProjectFile(contents);
  return Exit.isSuccess(decoded) ? decoded.value : null;
}

export function buildHackerAIProjectFileJsonSchema(): Record<string, unknown> {
  const document = Schema.toJsonSchemaDocument(HackerAIProjectFile, { onExcessProperty: "error" });
  const jsonSchema: Record<string, unknown> = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: HACKERAI_PROJECT_FILE_SCHEMA_URL,
    ...document.schema,
  };
  if (document.definitions && Object.keys(document.definitions).length > 0) {
    jsonSchema.$defs = document.definitions;
  }
  return jsonSchema;
}
