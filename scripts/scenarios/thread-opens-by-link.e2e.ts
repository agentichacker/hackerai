import { expect } from "e2e";

import { test, WEB } from "./hackerai.ts";

test(
  "A seeded thread opens by its link and shows its history",
  WEB,
  async ({ hackerai, app, screen }) => {
    const project = await hackerai.project("demo");
    const thread = await hackerai.thread({
      project,
      title: "Earlier work",
      messages: ["first", "second"],
    });
    await hackerai.open(thread);

    await expect(screen.getByText("second fixture turn complete", { exact: false })).toBeVisible();
    await app.screenshot("thread");
  },
);
