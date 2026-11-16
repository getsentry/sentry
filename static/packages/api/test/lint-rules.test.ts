import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const directory = mkdtempSync(join(tmpdir(), "lint-rules-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));

const RULE = "sentry-api/no-typescript-source-strings";

/** The 1-based lines RULE reports in `source`. */
function reportedLines(source: string): number[] {
  const config = join(directory, ".oxlintrc.json");
  writeFileSync(config, JSON.stringify({
    plugins: [],
    jsPlugins: [join(root, "lint", "plugin.mjs")],
    categories: { correctness: "off" },
    rules: { [RULE]: "error" },
  }));
  const file = join(directory, "fixture.mjs");
  writeFileSync(file, source);
  let output: string;
  try {
    output = execFileSync(join(root, "node_modules", ".bin", "oxlint"), ["-c", config, "-f", "json", file], { encoding: "utf8" });
  } catch (error) {
    output = (error as { stdout: string }).stdout;
  }
  const { diagnostics } = JSON.parse(output) as { diagnostics: { labels: [{ span: { line: number } }] }[] };
  return diagnostics.map(diagnostic => diagnostic.labels[0].span.line).sort((a, b) => a - b);
}

describe(RULE, () => {
  it("reports TypeScript files written from strings and string patches", () => {
    expect(reportedLines([
      'import { appendFileSync, writeFileSync } from "node:fs";',
      'const OUT = srcPath("out.gen.ts");',
      'writeFileSync("src/a.ts", "export {};\\n");',
      'writeFileSync(srcPath("b.ts"), ["export {};"].join("\\n"));',
      "writeFileSync(`${dir}/c.ts`, `export const c = ${value};`);",
      'appendFileSync(OUT, "export {};" + "\\n");',
      'source = replaceOnce(source, "a", "b");',
    ].join("\n"))).toEqual([3, 4, 5, 6, 7]);
  });

  it("allows printed TypeScript and non-TypeScript output", () => {
    expect(reportedLines([
      'import { writeFileSync } from "node:fs";',
      'writeFileSync("src/a.ts", printer.printFile(file));',
      'writeFileSync("out.json", JSON.stringify(data));',
      'writeFileSync("notes.md", ["a", "b"].join("\\n"));',
      'let path = "src/d.ts";',
      'writeFileSync(path, "x");',
    ].join("\n"))).toEqual([]);
  });
});
