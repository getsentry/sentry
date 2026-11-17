import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { installPackedPackage, packageRoot } from "./packed-package.ts";

/**
 * Names the README examples use without defining them: values that earlier
 * examples or the reader's own code supply.
 */
const context = `
  import type { SentryClient } from "@sentry/api";
  import type { findExistingObjects } from "@sentry/api/client";

  declare global {
    const process: { env: Record<string, string | undefined> };
    const sentry: SentryClient;
    const createSentryClient: typeof import("@sentry/api").createSentryClient;
    const SentryApiError: typeof import("@sentry/api").SentryApiError;
    const options: { path: { organization_id_or_slug: string } };
    const cursor: string | undefined;
    const regionUrls: Map<string, string>;
    const objectstore: Parameters<typeof findExistingObjects>[0];
    const keys: Parameters<typeof findExistingObjects>[1];
    const files: { key: string; size: number; path: string }[];
    const readFile: (path: string) => Promise<Uint8Array<ArrayBuffer>>;
    const readFileSync: (path: string, encoding: "utf8") => string;
    const input: unknown;
  }
`;

describe("README", () => {
  test("has TypeScript examples that typecheck against the packed package", { timeout: 60_000 }, () => {
    const readme = readFileSync(join(packageRoot, "README.md"), "utf8");
    const examples = [...readme.matchAll(/^```ts\n([\s\S]*?)^```$/gm)].map(match => ({
      // Name each file after the README line its code starts on.
      file: `readme-line-${readme.slice(0, match.index).split("\n").length + 1}.ts`,
      code: match[1]!,
    }));
    expect(examples.length).toBeGreaterThan(0);

    const directory = installPackedPackage("sentry-api-readme-");
    try {
      for (const peer of ["valibot", "zod"]) {
        symlinkSync(join(packageRoot, "node_modules", peer), join(directory, "node_modules", peer), "dir");
      }
      writeFileSync(join(directory, "context.d.ts"), context);
      // Each example is its own module, so their top-level names don't clash.
      for (const { file, code } of examples) writeFileSync(join(directory, file), `${code}\nexport {};\n`);
      // skipLibCheck: the examples are under test, not the package's own
      // declarations, and checking the validator schemas takes gigabytes.
      writeFileSync(join(directory, "tsconfig.json"), JSON.stringify({
        compilerOptions: {
          module: "ESNext", moduleResolution: "bundler", strict: true, skipLibCheck: true,
          noEmit: true, types: [], lib: ["ES2022", "DOM"],
        },
        files: ["context.d.ts", ...examples.map(({ file }) => file)],
      }));
      try {
        execFileSync("node", [join(packageRoot, "node_modules", "typescript", "bin", "tsc6"), "-p", directory], {
          encoding: "utf8",
        });
      } catch (error) {
        throw new Error(`README examples fail to typecheck:\n${(error as { stdout: string }).stdout}`);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
