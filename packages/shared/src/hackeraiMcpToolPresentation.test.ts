import { describe, expect, it } from "vite-plus/test";

import {
  HACKERAI_MCP_TOOL_NAMES,
  resolveHackerAIMcpSummaryAction,
  resolveHackerAIMcpToolDefinition,
  resolveHackerAIMcpToolPresentation,
} from "./hackeraiMcpToolPresentation.ts";

describe("resolveHackerAIMcpToolPresentation", () => {
  it("recognizes every HackerAI tool across provider prefixes and completion suffixes", () => {
    for (const tool of HACKERAI_MCP_TOOL_NAMES) {
      const presentation = resolveHackerAIMcpToolPresentation(tool);
      for (const prefix of [
        "mcp__hackerai-code__",
        "mcp__hackerai_code__",
        "mcp__hackerai__",
        "HackerAI-code.",
        "hackerai.",
        "hackerai-code-direct.",
        "mcp__hackerai_code_direct__",
        "hackerai_code/",
        "hackerai:",
        "mcp_hackerai-code_",
        "HackerAI ",
        "hackerai-code · ",
      ]) {
        expect(resolveHackerAIMcpToolPresentation(`${prefix}${tool} completed`), tool).toEqual(
          presentation,
        );
      }
      expect(resolveHackerAIMcpToolPresentation(`mcp__another-server__${tool}`), tool).toBeNull();
    }
  });

  it("matches OpenCode 2's per-thread server names, whose thread ids hold underscores", () => {
    expect(
      resolveHackerAIMcpToolPresentation("hackerai-code-thread_opencode2-adapter_delegate_task")
        ?.displayName,
    ).toBe("Delegate a child task");
    expect(
      resolveHackerAIMcpToolPresentation("hackerai-code-thread_opencode2-adapter_not_a_tool"),
    ).toBeNull();
  });
});

describe("resolveHackerAIMcpToolDefinition", () => {
  it("labels an action tool call as the action it ran", () => {
    expect(
      resolveHackerAIMcpToolDefinition("mcp__hackerai-code__preview_act", { action: "type" })
        ?.labels,
    ).toEqual(resolveHackerAIMcpToolDefinition("preview_type")?.labels);
    expect(
      resolveHackerAIMcpToolDefinition("hackerai_thread_transfer", { action: "fork" })?.displayName,
    ).toBe(resolveHackerAIMcpToolDefinition("hackerai_thread_fork")?.displayName);
    expect(resolveHackerAIMcpToolDefinition("preview_act", { action: "unknown" })?.labels[2]).toBe(
      "Used",
    );
  });
});

describe("resolveHackerAIMcpSummaryAction", () => {
  it("summarizes an action tool by the action each call ran", () => {
    expect(
      resolveHackerAIMcpSummaryAction("mcp__hackerai-code__hackerai_queue", { action: "list" }),
    ).toBe("queue-list");
    expect(resolveHackerAIMcpSummaryAction("hackerai_queue", { action: "edit" })).toBe(
      "queue-edit",
    );
    expect(resolveHackerAIMcpSummaryAction("hackerai_thread_transfer", { action: "status" })).toBe(
      "thread-transfers",
    );
    expect(resolveHackerAIMcpSummaryAction("hackerai_thread_configure", {})).toBe(
      "thread-configuration",
    );
    expect(resolveHackerAIMcpSummaryAction("schedule_task", { scheduledTaskId: "task-1" })).toBe(
      "schedule-update",
    );
    expect(resolveHackerAIMcpSummaryAction("delegate_task", { task: "x" })).toBe("delegate");
  });
});
