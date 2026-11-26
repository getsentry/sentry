import { describe, expect, it } from "vitest";
import { changeMessage, isBreakingChange } from "./consumers/breaking-change.mjs";

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

describe("changeMessage", () => {
  it("reads the PR title, then the pushed or queued commit message", () => {
    expect(changeMessage({ pull_request: { title: "ref(api)!: Drop it" } })).toBe("ref(api)!: Drop it");
    expect(changeMessage({ head_commit: { message: "ref(api)!: Drop it (#1)" } })).toBe("ref(api)!: Drop it (#1)");
    expect(changeMessage({ merge_group: { head_commit: { message: "ref(api)!: Drop it" } } })).toBe("ref(api)!: Drop it");
  });

  it("has no message outside GitHub Actions", () => {
    expect(changeMessage(undefined)).toBeUndefined();
  });
});
