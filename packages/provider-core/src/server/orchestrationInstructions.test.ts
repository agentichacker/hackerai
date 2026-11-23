import { assert, describe, it } from "@effect/vitest";

import {
  HACKERAI_CODE_DEVICE_TOOL_INSTRUCTIONS,
  HACKERAI_CODE_DEVICE_TOOL_INSTRUCTIONS_WITH_TOOL_SEARCH,
  HACKERAI_CODE_ORCHESTRATION_INSTRUCTIONS,
  hackeraiAcpPromptWithInstructions,
  hackeraiOrchestrationPrompt,
  hackeraiOrchestrationSystemPrompt,
} from "./orchestrationInstructions.ts";

describe("HackerAI device instructions", () => {
  it("route device work through device_open and give Claude the line that loads the tools", () => {
    for (const intent of ["`device_list`", "`device_open`", "`agent-device`", "ssh", "`hostId`"]) {
      assert.include(HACKERAI_CODE_DEVICE_TOOL_INSTRUCTIONS, intent);
    }
    assert.notInclude(HACKERAI_CODE_DEVICE_TOOL_INSTRUCTIONS, "ToolSearch");
    const loadLine =
      " Load them with ToolSearch `select:mcp__hackerai-code__device_list,mcp__hackerai-code__device_open,mcp__hackerai-code__device_screenshot,mcp__hackerai-code__device_close`.";
    assert.include(HACKERAI_CODE_DEVICE_TOOL_INSTRUCTIONS_WITH_TOOL_SEARCH, loadLine);
    assert.equal(
      HACKERAI_CODE_DEVICE_TOOL_INSTRUCTIONS_WITH_TOOL_SEARCH.replace(loadLine, ""),
      HACKERAI_CODE_DEVICE_TOOL_INSTRUCTIONS,
    );
  });

  it("open the app before the returned command's snapshots, screenshots and input", () => {
    assert.include(
      HACKERAI_CODE_DEVICE_TOOL_INSTRUCTIONS,
      "its snapshots, screenshots and input need `open <app>` first,",
    );
  });

  it("keep the failure rule from taking over or closing a session another thread holds", () => {
    // agent-device's DEVICE_IN_USE advice is to rerun with the owner's --session or close it first.
    assert.include(
      HACKERAI_CODE_DEVICE_TOOL_INSTRUCTIONS,
      "follow its advice once, but never reuse or close another session; if it still fails,",
    );
  });

  it("reach OpenCode and Cursor only when the session holds device access", () => {
    assert.include(hackeraiOrchestrationSystemPrompt(true, true), HACKERAI_CODE_DEVICE_TOOL_INSTRUCTIONS);
    assert.notInclude(hackeraiOrchestrationSystemPrompt(true, false), "## HackerAI devices");
    assert.isUndefined(hackeraiOrchestrationSystemPrompt(false, true));

    const firstRun = (hasDeviceTools: boolean) =>
      hackeraiOrchestrationPrompt({
        prompt: "Check the login screen.",
        hasHackerAIMcp: true,
        hasDeviceTools,
        orchestrationDelivered: false,
        deviceInstructionsDelivered: false,
      });
    assert.include(firstRun(true), HACKERAI_CODE_DEVICE_TOOL_INSTRUCTIONS);
    assert.notInclude(firstRun(false), "## HackerAI devices");

    const laterRun = (deviceInstructionsDelivered: boolean) =>
      hackeraiOrchestrationPrompt({
        prompt: "Check the login screen.",
        hasHackerAIMcp: true,
        hasDeviceTools: true,
        orchestrationDelivered: true,
        deviceInstructionsDelivered,
      });
    assert.include(laterRun(false), HACKERAI_CODE_DEVICE_TOOL_INSTRUCTIONS);
    assert.notInclude(laterRun(false), HACKERAI_CODE_ORCHESTRATION_INSTRUCTIONS.trim());
    assert.equal(laterRun(true), "Check the login screen.");

    // A provider's own guidance reaches a conversation that already had the rest.
    const providerRun = (providerInstructionsDelivered: boolean) =>
      hackeraiOrchestrationPrompt({
        prompt: "Check the login screen.",
        hasHackerAIMcp: true,
        hasDeviceTools: false,
        orchestrationDelivered: true,
        deviceInstructionsDelivered: false,
        providerInstructions: "Mark awaited shells.",
        providerInstructionsDelivered,
      });
    assert.include(providerRun(false), "Mark awaited shells.");
    assert.notInclude(providerRun(false), HACKERAI_CODE_ORCHESTRATION_INSTRUCTIONS.trim());
    assert.equal(providerRun(true), "Check the login screen.");
  });

  it("reach ACP agents again when device access changes mid-thread", () => {
    const state = { interactionMode: "default", hasHackerAIMcp: true, hasDeviceTools: false } as const;
    const withDevices = hackeraiAcpPromptWithInstructions({
      prompt: "Check the login screen.",
      state: { ...state, hasDeviceTools: true },
      previousState: state,
    });
    assert.include(withDevices, HACKERAI_CODE_DEVICE_TOOL_INSTRUCTIONS);
    assert.equal(
      hackeraiAcpPromptWithInstructions({ prompt: "Again.", state, previousState: state }),
      "Again.",
    );
    assert.notInclude(hackeraiAcpPromptWithInstructions({ prompt: "Hi.", state }), "## HackerAI devices");
  });
});
