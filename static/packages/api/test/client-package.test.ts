import { build } from "esbuild";
import { describe, expect, test } from "vitest";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { installPackedPackage } from "./packed-package.ts";

/**
 * Exercises the packed client the way a host uses it: the browser session
 * fetch, under the shared transport and request core, under an endpoint
 * wrapper, against a mocked `fetch`. Returns what the mock saw.
 */
const SCENARIO = `
  import { SentryApiError } from "@sentry/api";
  import { createBrowserFetch } from "@sentry/api/browser";
  import {
    ApiNotFoundError,
    createApiClientCore,
    createApiTransport,
  } from "@sentry/api/client";
  import { listOrganizations } from "@sentry/api/client/endpoints";

  const anyRows = { "~standard": { version: 1, vendor: "test", validate: (value) => ({ value }) } };

  export async function run() {
    const seen = [];
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      seen.push({ method: request.method, url: request.url, credentials: request.credentials });
      return request.url.includes("/missing/")
        ? Response.json({ detail: "Not found" }, { status: 404 })
        : Response.json([{ slug: "acme" }]);
    };
    const transport = createApiTransport({
      fetch: createBrowserFetch({ getCsrfToken: () => "csrf" }),
      retry: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, maxTotalDelayMs: 0 },
    });
    const core = createApiClientCore({ transport, headers: () => ({}), logger: { warn() {} } });
    const target = { core, origin: "https://sentry.example.test" };

    const page = await listOrganizations(target, { limit: 1 }, anyRows);
    const error = await core.requestJson(target.origin, "/missing/").catch((caught) => caught);
    return {
      seen,
      items: page.items,
      notFound: error instanceof ApiNotFoundError,
      sharedErrorType: error instanceof SentryApiError,
      status: error.status,
    };
  }
`;

describe("@sentry/api/client package entry", () => {
  test("bundles for the browser and makes a request against a mocked fetch", { timeout: 60_000 }, async () => {
    const directory = installPackedPackage("api-client-package-");
    try {
      const entry = join(directory, "scenario.js");
      writeFileSync(entry, SCENARIO);
      const result = await build({
        entryPoints: [entry], bundle: true, format: "esm", platform: "browser",
        write: false, logLevel: "silent",
      });
      expect(result.warnings).toEqual([]);
      expect(result.errors).toEqual([]);
      const bundle = result.outputFiles[0]!.text;
      expect(bundle).not.toMatch(/["']node:/);
      // Each entry imports the others by name, so the bundle has one copy of each class.
      expect(bundle.match(/\bSentryApiError = class\b/g)).toHaveLength(1);

      const bundled = join(directory, "bundled.js");
      writeFileSync(bundled, bundle);
      const originalFetch = globalThis.fetch;
      try {
        const { run } = await import(bundled);
        expect(await run()).toEqual({
          seen: [
            {
              method: "GET",
              url: "https://sentry.example.test/api/0/organizations/?per_page=1",
              credentials: "include",
            },
            { method: "GET", url: "https://sentry.example.test/api/0/missing/", credentials: "include" },
          ],
          items: [{ slug: "acme" }],
          notFound: true,
          sharedErrorType: true,
          status: 404,
        });
      } finally {
        globalThis.fetch = originalFetch;
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
