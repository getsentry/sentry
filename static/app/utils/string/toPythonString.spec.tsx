import { toPythonString } from "sentry/utils/string/toPythonString";

describe("toPythonString", () => {
  it("converts strings", () => {
    expect(toPythonString("hello")).toBe("hello");
    expect(toPythonString("")).toBe("");
  });

  it("converts booleans to Python format", () => {
    expect(toPythonString(true)).toBe("True");
    expect(toPythonString(false)).toBe("False");
  });

  it("converts null and undefined to None", () => {
    expect(toPythonString(null)).toBe("None");
    expect(toPythonString(undefined)).toBe("None");
  });

  it("converts numbers", () => {
    expect(toPythonString(42)).toBe("42");
    expect(toPythonString(0)).toBe("0");
    expect(toPythonString(-3.14)).toBe("-3.14");
  });

  it("converts arrays with mixed types", () => {
    expect(toPythonString([1, "two", null, true, undefined])).toBe(
      "[1, 'two', None, True, None]",
    );
  });

  it("converts empty arrays", () => {
    expect(toPythonString([])).toBe("[]");
  });
});
