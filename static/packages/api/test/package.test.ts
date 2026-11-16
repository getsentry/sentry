import { build } from "esbuild";
import { describe, expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import packageJson from "../package.json";
import { installPackedPackage, packageRoot } from "./packed-package.ts";

const readBundle = (name: string) =>
  readFile(new URL(`../dist/${name}.js`, import.meta.url), "utf8");

describe("package entry points", () => {
  test("keeps validator and source-analysis peers optional", () => {
    expect(packageJson.peerDependencies).toEqual({
      typescript: "*",
      valibot: "*",
      zod: "^4.6.6",
    });
    expect(packageJson.peerDependenciesMeta).toEqual({
      typescript: { optional: true },
      valibot: { optional: true },
      zod: { optional: true },
    });
  });

  test("keeps the root bundle independent from optional tools and validators", async () => {
    const root = await readBundle("index");
    expect(root).not.toMatch(/from ["']typescript["']/);
    expect(root).not.toMatch(/from ["']valibot["']/);
    expect(root).not.toMatch(/from ["']zod["']/);
  });

  test("isolates optional tools and validators to their own entry points", async () => {
    const [valibot, zod, analysis] = await Promise.all([
      readBundle("valibot"),
      readBundle("zod"),
      readBundle("source-analysis"),
    ]);
    expect(valibot).toMatch(/from ["']valibot["']/);
    expect(valibot).not.toMatch(/from ["']zod["']/);
    expect(zod).toMatch(/from ["']zod["']/);
    expect(zod).not.toMatch(/from ["']valibot["']/);
    expect(analysis).toMatch(/from ["']typescript["']/);
    expect(analysis).not.toMatch(/from ["'](?:valibot|zod)["']/);
  });

  test("lets bundlers drop unused schemas and the unused default client", async () => {
    const directory = mkdtempSync(join(tmpdir(), "api-tree-shaking-"));
    try {
      const entry = join(directory, "entry.ts");
      const dist = fileURLToPath(new URL("../dist/", import.meta.url));
      writeFileSync(entry, `
        import { vGetOrganizationResponse } from ${JSON.stringify(join(dist, "valibot.js"))};
        import { zGetOrganizationResponse } from ${JSON.stringify(join(dist, "zod.js"))};
        import { SentryApiError } from ${JSON.stringify(join(dist, "index.js"))};
        console.log(vGetOrganizationResponse, zGetOrganizationResponse, SentryApiError);
      `);
      const result = await build({
        entryPoints: [entry], bundle: true, format: "esm", platform: "node",
        external: ["valibot", "zod"], write: false, logLevel: "silent",
      });
      expect(result.errors).toEqual([]);
      const output = result.outputFiles[0]!.text;
      const kept = (name: string) => output.includes(name);
      expect(["vGetOrganizationResponse", "zGetOrganizationResponse", "SentryApiError"].filter(kept))
        .toEqual(["vGetOrganizationResponse", "zGetOrganizationResponse", "SentryApiError"]);
      expect(["vListOrganizationsResponse", "zListOrganizationsResponse", "defaultClient", "new Proxy"].filter(kept))
        .toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("packs isolated runtime entries, pagination and build-time analysis", { timeout: 60_000 }, () => {
    const root = packageRoot;
    const directory = installPackedPackage("api-package-");
    try {
      writeFileSync(join(directory, "client.mjs"), `
        import assert from "node:assert/strict";
        const client = await import("@sentry/api");
        const browser = await import("@sentry/api/browser");
        assert.equal(typeof client.createSentryClient, "function");
        assert.equal(typeof browser.createBrowserFetch, "function");
        assert.equal("analyzeSourceApiUsage" in client, false);
        const sentry = client.createSentryClient({baseUrl: "https://example.test/prefix"});
        const request = await sentry.client.prepareRequest({
          method: "POST", url: "/custom/?field=id&field=name&cursor=old#view",
          query: {cursor: "opaque:next"}, body: {message: "example"},
        });
        assert.equal(request.url, "https://example.test/prefix/api/0/custom/?field=id&field=name&cursor=opaque%3Anext");
        assert.equal(request.headers.get("content-type"), "application/json");
        assert.deepEqual(await request.clone().json(), {message: "example"});
        const transport = async request => new Response(await request.text(), {status: 422});
        const response = await transport(request);
        assert.equal(response.status, 422);
        assert.deepEqual(await response.json(), {message: "example"});
      `);
      execFileSync("node", ["client.mjs"], { cwd: directory });
      writeFileSync(join(directory, "smoke.mjs"), `
        import assert from "node:assert/strict";
        for (const name of ["fetch", "Request", "Headers"]) {
          Object.defineProperty(globalThis, name, { get() { throw new Error("Accessed transport global: " + name); } });
        }
        const { operations } = await import("@sentry/api/operations");
        assert(operations.some(operation => operation.functionName === "listOrganizations"));
        const docs = await import("@sentry/api/docs");
        assert(docs.operations.some(operation => operation.path === "/organizations/"));
        // The root entry creates its default client on first use, not at import.
        const root = await import("@sentry/api");
        assert.equal(typeof root.getOrganization, "function");
      `);
      execFileSync("node", ["smoke.mjs"], { cwd: directory });

      writeFileSync(join(directory, "pagination.mjs"), `
        import assert from "node:assert/strict";
        import { consumePage, createSentryClient } from "@sentry/api";
        const requests = [];
        const sentry = createSentryClient({
          baseUrl: "https://example.test",
          fetch: async request => {
            requests.push(new URL(request.url).searchParams.get("per_page"));
            return Response.json([{slug:"one"}, {slug:"two"}, {slug:"three"}]);
          },
        });
        const options = {path: {organization_id_or_slug: "example"}, query: {per_page: 3}};
        const first = await sentry.paginateUpTo.listOrganizationProjects(options, {limit: 2});
        const resume = JSON.parse(JSON.stringify(first.continuation));
        const last = await sentry.paginateUpTo.listOrganizationProjects(options, {limit: 1, resume});
        assert.deepEqual([...first.data, ...last.data].map(row => row.slug), ["one", "two", "three"]);
        assert.equal(first.nextCursor, undefined);
        assert.equal(last.stopReason, "exhausted");
        assert.deepEqual(requests, ["3", "3"]);
        assert.deepEqual(consumePage({data: last.data}, {offset: 0}).data, last.data);
      `);
      execFileSync("node", ["pagination.mjs"], { cwd: directory });

      writeFileSync(join(directory, "types.ts"), readFileSync(new URL("./operation-types.ts", import.meta.url)));
      writeFileSync(join(directory, "analysis-types.ts"), readFileSync(new URL("./source-analysis-types.ts", import.meta.url)));
      writeFileSync(join(directory, "tsconfig.json"), JSON.stringify({
        compilerOptions: { module: "NodeNext", strict: true, noEmit: true, types: [], lib: ["ES2022"] },
        files: ["types.ts", "analysis-types.ts"],
      }));
      execFileSync("node", [join(root, "node_modules", "typescript", "bin", "tsc6"), "-p", directory]);

      writeFileSync(join(directory, "types.ts"), `
        import { consumePage, type PaginationContinuation, type PagePosition, type SentryClient } from "@sentry/api";
        declare const sentry: SentryClient;
        const prepared: Promise<Request> = sentry.client.prepareRequest({method: "GET", url: "/custom/"});
        const position: PagePosition = {cursor: "opaque", offset: 2};
        const resume: PaginationContinuation = {...position, requestBudget: 10};
        const rows: string[] = consumePage({data: ["one"]}, position).data;
        sentry.paginateUpTo.listOrganizationProjects(
          {path: {organization_id_or_slug: "example"}}, {limit: 5, resume},
        );
      `);
      writeFileSync(join(directory, "tsconfig.json"), JSON.stringify({
        compilerOptions: {
          module: "ESNext", moduleResolution: "bundler", strict: true,
          noEmit: true, types: [], lib: ["ES2022", "DOM"],
        },
        files: ["types.ts"],
      }));
      execFileSync("node", [join(root, "node_modules", "typescript", "bin", "tsc6"), "-p", directory]);

      symlinkSync(join(root, "node_modules", "typescript"), join(directory, "node_modules", "typescript"), "dir");
      writeFileSync(join(directory, "analysis.mjs"), `
        import assert from "node:assert/strict";
        import { operations } from "@sentry/api/operations";
        import { analyzeSourceApiUsage } from "@sentry/api/source-analysis";
        const source = 'import { listOrganizationEvents } from "@sentry/api"; export default listOrganizationEvents;';
        const result = analyzeSourceApiUsage(new Map([
          ["logs/index.ts", source],
          ["feature.ts", 'import read from "./logs"; export const readLogs = () => read({ path: { organization_id_or_slug: "example-org" }, query: { dataset: "logs", field: ["message"] } });'],
        ]), operations, {
          queryParameters: ["dataset"],
        });
        const usage = result.exports.get("feature.ts").get("readLogs");
        assert.equal(usage.operations[0].functionName, "listOrganizationEvents");
        assert.deepEqual(usage.operations[0].query, { dataset: "logs" });
        assert.deepEqual(usage.methods, ["GET"]);
        assert.deepEqual(usage.unresolvedRequests, []);
        assert.equal(result.exports.get("logs/index.ts").get("default").operations[0].functionName, "listOrganizationEvents");
      `);
      execFileSync("node", ["analysis.mjs"], { cwd: directory });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
