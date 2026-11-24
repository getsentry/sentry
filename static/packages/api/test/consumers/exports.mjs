/**
 * Fails when the packed @sentry/api tarball drops an entry point or an export
 * that the latest release on npm has, which breaks code written against that
 * release. A renamed export shows up as the old name going missing.
 *
 *   node test/consumers/exports.mjs path/to/sentry-api-x.y.z.tgz
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import ts from "typescript";

const [tarball] = process.argv.slice(2);
if (!tarball) throw new Error("Usage: exports.mjs <packed @sentry/api tarball>");

/** Unpack `file` into `directory` and return it. */
function unpack(file, directory) {
  mkdirSync(directory);
  execFileSync("tar", ["-xzf", file, "-C", directory, "--strip-components=1"]);
  return directory;
}

/** Each entry point's exported names, from its declaration file, by subpath. */
function exportsOf(directory) {
  const { exports } = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  const entries = Object.entries(exports).map(([subpath, { types }]) => [subpath, join(directory, types)]);
  const program = ts.createProgram(entries.map(([, file]) => file), { noEmit: true, skipLibCheck: true, types: [] });
  const checker = program.getTypeChecker();
  return new Map(entries.map(([subpath, file]) => {
    const module = checker.getSymbolAtLocation(program.getSourceFile(file));
    const names = module ? checker.getExportsOfModule(module).map(symbol => symbol.name) : [];
    // An unreadable declaration file would make every comparison pass.
    if (names.length === 0) throw new Error(`Found no exports in ${file} for "${subpath}"`);
    return [subpath, new Set(names)];
  }));
}

const work = mkdtempSync(join(tmpdir(), "sentry-api-exports-"));
try {
  const packed = execFileSync("npm", ["pack", "--json", "@sentry/api@latest"], { cwd: work, encoding: "utf8" });
  const [{ filename, version }] = JSON.parse(packed);
  const released = exportsOf(unpack(join(work, filename), join(work, "released")));
  const current = exportsOf(unpack(resolve(tarball), join(work, "current")));

  const missing = [];
  for (const [subpath, names] of released) {
    const now = current.get(subpath);
    if (!now) {
      missing.push(`the "${subpath}" entry point`);
      continue;
    }
    for (const name of names) if (!now.has(name)) missing.push(`${name} from "${subpath}"`);
  }
  if (missing.length > 0) {
    console.error(`Compared with @sentry/api ${version}, this package no longer exports:\n${missing.map(item => `  ${item}`).join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log(`Every entry point and export of @sentry/api ${version} is still there.`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
