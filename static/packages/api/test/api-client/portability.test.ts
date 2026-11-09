/**
 * The shared client must run in browsers and Workers. `tsconfig.browser.json`
 * typechecks it against the DOM library with no Node types, which catches
 * Node globals; this test catches the imports that typecheck would still
 * resolve: Node built-ins and the validators hosts pass in themselves.
 */
import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { join, relative } from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const LIB = fileURLToPath(new URL("../../lib/api-client/", import.meta.url));

const NODE_MODULES = new Set(builtinModules.map((name) => name.split("/")[0]));
const HOST_VALIDATORS = /^(?:zod|valibot)(?:\/|$)|^@sentry\/api\/(?:zod|valibot)$/;

function forbidden(specifier: string): boolean {
  return (
    specifier.startsWith("node:") ||
    NODE_MODULES.has(specifier.split("/")[0]!) ||
    HOST_VALIDATORS.test(specifier)
  );
}

/** Module specifiers a source file imports, re-exports, or loads dynamically. */
function importedModules(fileName: string, source: string): string[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return specifiers;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith(".ts") ? [path] : [];
  });
}

describe("shared client portability", () => {
  test("imports no Node built-ins or host validators", () => {
    const violations = sourceFiles(LIB).flatMap((path) =>
      importedModules(path, readFileSync(path, "utf8"))
        .filter(forbidden)
        .map((specifier) => `${relative(LIB, path)}: ${specifier}`),
    );
    expect(violations).toEqual([]);
  });

  test("flags a planted Node import", () => {
    const planted = [
      'import { gzip } from "node:zlib";',
      'export { Buffer } from "buffer";',
      'const z = await import("zod");',
      'import { createSentryClient } from "@sentry/api";',
    ].join("\n");
    expect(importedModules("planted.ts", planted).filter(forbidden)).toEqual([
      "node:zlib",
      "buffer",
      "zod",
    ]);
  });
});
