import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The repository root, where the built package lives. */
export const packageRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

/**
 * `npm pack` the built package and install the tarball, with its runtime
 * dependencies, into a fresh ES module project. The caller removes it.
 */
export function installPackedPackage(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", directory], {
    cwd: packageRoot,
    encoding: "utf8",
  })) as { filename: string }[];
  const installed = join(directory, "node_modules", "@sentry", "api");
  mkdirSync(installed, { recursive: true });
  execFileSync("tar", ["-xzf", join(directory, packed[0]!.filename), "-C", installed, "--strip-components=1"]);
  const { dependencies } = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
    dependencies: Record<string, string>;
  };
  for (const name of Object.keys(dependencies)) {
    symlinkSync(join(packageRoot, "node_modules", name), join(directory, "node_modules", name), "dir");
  }
  writeFileSync(join(directory, "package.json"), JSON.stringify({ type: "module" }));
  return directory;
}
