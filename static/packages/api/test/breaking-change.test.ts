import { describe, expect, it } from "vitest";
import { isBreakingChange } from "./consumers/breaking-change.mjs";

describe("isBreakingChange", () => {
  it.each([
    "ref(api)!: Remove the response cache",
    "feat!: Drop Node 20",
    "fix(api): Read the reset header\n\nBREAKING CHANGE: parseRetryDelayMs moved",
    "fix(api): Read the reset header\n\nBREAKING-CHANGE: parseRetryDelayMs moved",
  ])("treats %j as breaking", (message) => {
    expect(isBreakingChange(message)).toBe(true);
  });

  it.each([
    undefined,
    "",
    "feat(api): Add a helper",
    "fix(api): Say why a breaking change! needs a major",
    "docs(api): Explain BREAKING CHANGE: footers",
  ])("treats %j as not breaking", (message) => {
    expect(isBreakingChange(message)).toBe(false);
  });
});
