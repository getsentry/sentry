import { describe, expect, it } from "vitest";
import { edit } from "../lib/generated-source.mjs";

describe("edit", () => {
  it("applies replacements given in any order", () => {
    const source = "const a = 1; const b = 2;";
    expect(edit(source, [
      { start: 19, end: 20, text: "y" },
      { start: 6, end: 7, text: "x" },
    ])).toBe("const x = 1; const y = 2;");
  });

  it("puts insertions at the same position in reverse order", () => {
    expect(edit("ab", [
      { start: 1, end: 1, text: "1" },
      { start: 1, end: 1, text: "2" },
    ])).toBe("a21b");
  });

  it("rejects overlapping replacements", () => {
    expect(() => edit("abcdef", [
      { start: 1, end: 4, text: "" },
      { start: 3, end: 5, text: "" },
    ])).toThrow(/Overlapping edits/);
  });
});
