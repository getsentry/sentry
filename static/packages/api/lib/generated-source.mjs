/**
 * Helpers for the build steps in scripts/, which read and patch the files
 * Hey API generates into src/. Each patch fails closed, so a generator
 * upgrade cannot silently drop it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/** The absolute path of `name` under src/. */
export const srcPath = name => fileURLToPath(new URL(`../src/${name}`, import.meta.url));

/** Replace the one match of `before`, a string or a RegExp, or throw. */
export function replaceOnce(source, before, after) {
  const matches = typeof before === "string"
    ? source.split(before).length - 1
    : [...source.matchAll(new RegExp(before.source, "g"))].length;
  if (matches !== 1) {
    throw new Error(`Generated code changed: expected one match, got ${matches}: ${before}`);
  }
  return source.replace(before, () => after);
}

/** Rewrite src/`name` with `transform(source, name)`. */
export function update(name, transform) {
  const path = srcPath(name);
  writeFileSync(path, transform(readFileSync(path, "utf8"), name));
}

/**
 * Write src/`name` from TypeScript AST `statements`, printed by the compiler,
 * so generated modules are built from nodes rather than source strings.
 */
export function writeSource(name, statements) {
  const path = srcPath(name);
  const file = ts.factory.updateSourceFile(
    ts.createSourceFile(path, "", ts.ScriptTarget.Latest, false, ts.ScriptKind.TS),
    statements,
  );
  writeFileSync(path, ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(file));
}

/** Parse src/`name`, keeping its text for position-based edits. */
export function parse(name) {
  const path = srcPath(name);
  const text = readFileSync(path, "utf8");
  return { path, text, source: ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true) };
}

/**
 * Apply `{ start, end, text }` replacements, which must not overlap, in one
 * pass. Insertions at the same position land in reverse order, as they did
 * when each edit was applied to the whole string from the end.
 */
export function edit(source, changes) {
  const ordered = changes
    .map((change, index) => ({ ...change, index }))
    .sort((a, b) => a.start - b.start || b.index - a.index);
  const parts = [];
  let last = 0;
  for (const { start, end, text } of ordered) {
    if (start < last) throw new Error(`Overlapping edits at ${start}`);
    parts.push(source.slice(last, start), text);
    last = end;
  }
  parts.push(source.slice(last));
  return parts.join("");
}
