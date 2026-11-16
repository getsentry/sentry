/**
 * Emit the declarations `tsc --emitDeclarationOnly` would, from tsconfig.json,
 * in parallel worker threads.
 *
 * Checking the Valibot and Zod schemas takes most of tsc's time, and neither
 * file imports anything else in src/. Each worker builds a program from one
 * group of root files, reports its diagnostics, and writes its declarations;
 * the files outside every group form one more program.
 *
 * Hey API's modules import each other without file extensions, which NodeNext
 * resolution rejects, so the emit gives those specifiers the `.ts` extension
 * the rest of src/ uses. Declaration files resolve `.ts` to `.d.ts`.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parentPort, Worker, workerData } from "node:worker_threads";
import ts from "typescript";

const CONFIG = fileURLToPath(new URL("../tsconfig.json", import.meta.url));
const formatHost = {
  getCanonicalFileName: name => name,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getNewLine: () => ts.sys.newLine,
};

function readConfig() {
  const { config, error } = ts.readConfigFile(CONFIG, ts.sys.readFile);
  if (error) throw new Error(ts.flattenDiagnosticMessageText(error.messageText, "\n"));
  return ts.parseJsonConfigFileContent(config, ts.sys, fileURLToPath(new URL("..", import.meta.url)));
}

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

/** A declaration transformer that adds extensions to relative module specifiers. */
const addImportExtensions = context => file => {
  const { factory } = context;
  const visit = node => {
    if (!(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) || !node.moduleSpecifier) {
      return ts.visitEachChild(node, visit, context);
    }
    const before = node.moduleSpecifier.text;
    const after = withExtension(before, file.fileName);
    if (after === before) return node;
    const specifier = factory.createStringLiteral(after);
    return ts.isImportDeclaration(node)
      ? factory.updateImportDeclaration(node, node.modifiers, node.importClause, specifier, node.attributes)
      : factory.updateExportDeclaration(node, node.modifiers, node.isTypeOnly, node.exportClause, specifier, node.attributes);
  };
  return ts.visitNode(file, visit);
};

/** Emit `rootNames`' declarations; returns tsc's formatted diagnostics, if any. */
function emit(rootNames) {
  const { options } = readConfig();
  const program = ts.createProgram({ rootNames, options });
  const result = program.emit(undefined, undefined, undefined, true, { afterDeclarations: [addImportExtensions] });
  const diagnostics = [...ts.getPreEmitDiagnostics(program), ...result.diagnostics];
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost);
}

/** Emit every declaration, one program per group of src/ paths plus one for the rest. */
export async function emitDeclarations(groups) {
  const { fileNames, errors } = readConfig();
  if (errors.length) throw new Error(ts.formatDiagnostics(errors, formatHost));
  const grouped = groups.map(names => names.map(name => fileURLToPath(new URL(`../src/${name}`, import.meta.url))));
  // tsc reports POSIX separators even on Windows, so compare resolved paths.
  const claimed = new Set(grouped.flat().map(name => path.resolve(name)));
  const rest = fileNames.filter(name => !claimed.has(path.resolve(name)));
  if (fileNames.length - rest.length !== claimed.size) {
    throw new Error("A declaration group names a file outside tsconfig.json's files");
  }
  const reports = await Promise.all([...grouped, rest].map(rootNames => new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: { declarations: rootNames } });
    worker.once("message", resolve);
    worker.once("error", reject);
    worker.once("exit", code => reject(new Error(`Declaration worker exited with code ${code}`)));
  })));
  const failures = reports.filter(Boolean);
  if (failures.length) {
    process.stderr.write(failures.join(""));
    throw new Error("Declaration emit failed");
  }
}

if (workerData?.declarations) parentPort.postMessage(emit(workerData.declarations));
