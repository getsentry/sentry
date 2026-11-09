/**
 * Emit the declarations `tsc --emitDeclarationOnly` would, from tsconfig.json,
 * in parallel worker threads.
 *
 * Checking the Valibot and Zod schemas takes most of tsc's time, and neither
 * file imports anything else in src/. Each worker builds a program from one
 * group of root files, reports its diagnostics, and writes its declarations;
 * the files outside every group form one more program.
 */
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

/** Emit `rootNames`' declarations; returns tsc's formatted diagnostics, if any. */
function emit(rootNames) {
  const { options } = readConfig();
  const program = ts.createProgram({ rootNames, options });
  const result = program.emit();
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
