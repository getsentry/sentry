/**
 * Checks a packed @sentry/api tarball the way an outside project uses it: it
 * installs the tarball from npm's resolver into a fresh project with no
 * optional peers and runs smoke.mjs, then installs each validator peer on its
 * own and runs validators.mjs. Both run on the runtime that runs this script,
 * so CI starts it once with each runtime it supports.
 *
 *   node test/consumers/check.mjs path/to/sentry-api-x.y.z.tgz
 *   bun test/consumers/check.mjs path/to/sentry-api-x.y.z.tgz
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const [tarball] = process.argv.slice(2);
if (!tarball) throw new Error("Usage: check.mjs <packed @sentry/api tarball>");

const runtime = process.versions.bun ? `Bun ${process.versions.bun}` : `Node.js ${process.version}`;

/** A fresh ES module project with the tarball and `packages` installed. */
function consumer(packages) {
  const directory = mkdtempSync(join(tmpdir(), "sentry-api-consumer-"));
  writeFileSync(join(directory, "package.json"), JSON.stringify({ private: true, type: "module" }));
  execFileSync("npm", ["install", "--no-audit", "--no-fund", "--ignore-scripts", resolve(tarball), ...packages], {
    cwd: directory,
    stdio: "inherit",
  });
  return directory;
}

/** Run one of this directory's scripts in `directory`, on this runtime. */
function run(directory, script, ...args) {
  copyFileSync(new URL(script, import.meta.url), join(directory, script));
  execFileSync(process.execPath, [script, ...args], { cwd: directory, stdio: "inherit" });
}

const bare = consumer([]);
try {
  run(bare, "smoke.mjs");
  const { peerDependencies } = JSON.parse(
    readFileSync(join(bare, "node_modules", "@sentry", "api", "package.json"), "utf8"),
  );
  for (const peer of ["zod", "valibot"]) {
    const directory = consumer([`${peer}@${peerDependencies[peer]}`]);
    try {
      run(directory, "validators.mjs", peer);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
} finally {
  rmSync(bare, { recursive: true, force: true });
}
console.log(`The packed package works on ${runtime}.`);
