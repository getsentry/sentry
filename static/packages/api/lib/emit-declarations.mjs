/**
 * Emit the declarations tsconfig.json describes with TypeScript 7's tsc, then
 * add file extensions to the relative imports in them.
 *
 * Hey API's modules import each other without file extensions, which NodeNext
 * resolution rejects, so each such specifier gets the `.ts` extension the rest
 * of src/ uses. Declaration files resolve `.ts` to `.d.ts`.
 *
 * TypeScript 7 has no stable API for emit transformers, so the specifiers are
 * rewritten in the emitted files. TypeScript 6 only parses them to find each
 * specifier.
 */
import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import ts from "typescript";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TSC = path.join(path.dirname(createRequire(import.meta.url).resolve("typescript-7/package.json")), "bin", "tsc");

/** Extensions NodeNext resolves; Hey API's `.gen` suffix is not one. */
const MODULE_EXTENSIONS = new Set([".ts", ".mts", ".cts", ".js", ".mjs", ".cjs", ".json"]);

/** `specifier` with a file extension, if it is relative and has none. */
function withExtension(specifier, fromFile) {
  if (!/^\.\.?\//.test(specifier) || MODULE_EXTENSIONS.has(path.extname(specifier))) return specifier;
  const target = path.resolve(path.dirname(fromFile), specifier);
  if (existsSync(`${target}.ts`)) return `${specifier}.ts`;
  if (existsSync(path.join(target, "index.ts"))) return `${specifier}/index.ts`;
  throw new Error(`${fromFile} imports ${specifier}, which is not a module in src/`);
}

/** The string literals that name a module, including inferred `import("./module").Name` types. */
function moduleSpecifiers(file) {
  const found = [];
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      found.push(node.moduleSpecifier);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      found.push(node.argument.literal);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/** Add extensions to the relative imports in `declarationFile`, resolved from `sourceFile`'s directory. */
function addImportExtensions(declarationFile, sourceFile) {
  const text = readFileSync(declarationFile, "utf8");
  const file = ts.createSourceFile(declarationFile, text, ts.ScriptTarget.Latest, true);
  let result = text;
  // From the end, so earlier offsets stay valid.
  for (const literal of moduleSpecifiers(file).reverse()) {
    const after = withExtension(literal.text, sourceFile);
    if (after === literal.text) continue;
    // Keep the emitted quote character.
    const start = literal.getStart(file) + 1;
    result = result.slice(0, start) + after + result.slice(literal.end - 1);
  }
  if (result !== text) writeFileSync(declarationFile, result);
}

/** Emit every declaration from tsconfig.json into dist/. */
export async function emitDeclarations() {
  let stdout;
  try {
    ({ stdout } = await promisify(execFile)(
      process.execPath,
      [TSC, "-p", path.join(ROOT, "tsconfig.json"), "--listEmittedFiles"],
      { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 },
    ));
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    process.stderr.write(output.split("\n").filter(line => !line.startsWith("TSFILE: ")).join("\n"));
    throw new Error("Declaration emit failed");
  }
  const dist = path.join(ROOT, "dist");
  for (const line of stdout.split("\n")) {
    if (!line.startsWith("TSFILE: ")) continue;
    const file = line.slice("TSFILE: ".length).trim();
    addImportExtensions(file, path.join(ROOT, "src", path.relative(dist, file)));
  }
}
