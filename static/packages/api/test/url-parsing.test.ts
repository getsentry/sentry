import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, test } from "vitest";
import { packageRoot } from "./packed-package.ts";

/**
 * Lines with a regular expression that matches a URL scheme separator. The
 * repo parses URLs with `URL` (`new URL`, `URL.canParse`), not regexes.
 */
function urlRegexLines(fileName: string, source: string): number[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const lines: number[] = [];
  const visit = (node: ts.Node): void => {
    const pattern = ts.isRegularExpressionLiteral(node)
      ? node.text
      : (ts.isNewExpression(node) || ts.isCallExpression(node))
          && ts.isIdentifier(node.expression)
          && node.expression.text === "RegExp"
          && node.arguments?.[0]
          && ts.isStringLiteralLike(node.arguments[0])
        ? node.arguments[0].text
        : undefined;
    if (pattern?.includes("://") || pattern?.includes(":\\/\\/")) {
      lines.push(file.getLineAndCharacterOfPosition(node.getStart()).line + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return lines;
}

const SOURCE_EXTENSIONS = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"];

describe("URL parsing", () => {
  test.each([
    ["a regex literal", "const r = /^(https?:\\/\\/[^/]*)/;", [1]],
    ["a RegExp constructor", 'const r = new RegExp("^https://");', [1]],
    ["a path-only regex", "const r = /\\/api\\/0\\//;", []],
    ["URL parsing", 'const { origin } = new URL("https://sentry.io/api/0");', []],
  ])("flags %s", (_, source, lines) => {
    expect(urlRegexLines("example.ts", source)).toEqual(lines);
  });

  test("the repo parses URLs with URL, not regexes", () => {
    const files = execFileSync("git", ["ls-files"], { cwd: packageRoot, encoding: "utf8" })
      .split("\n")
      .filter(file => SOURCE_EXTENSIONS.some(extension => file.endsWith(extension)));
    const offenders = files.flatMap(file =>
      urlRegexLines(file, readFileSync(`${packageRoot}/${file}`, "utf8")).map(line => `${file}:${line}`),
    );
    expect(offenders).toEqual([]);
  });
});
