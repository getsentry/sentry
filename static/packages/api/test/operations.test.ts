import { describe, expect, test } from "vitest";
import { createClient } from "@hey-api/openapi-ts";
import { API_BASE_PATH, operations } from "@sentry/api/operations";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { splitApiBasePath } from "../lib/api-base-path.mjs";
import { extractOperations } from "../lib/operation-catalog.mjs";
import { normalizeSpec } from "../lib/normalize-spec.mjs";
import * as sdk from "../src/sdk.gen";

const eventsPath = "/organizations/{organization_id_or_slug}/events/";

// The events endpoint demonstrates both dataset discovery and repeated fields.
const fixture = (datasets = ["logs", "spans"]) => ({
  openapi: "3.0.3",
  info: { title: "Operation discovery", version: "1" },
  paths: {
    [eventsPath]: {
      parameters: [
        { name: "organization_id_or_slug", in: "path", required: true, schema: { type: "string" } },
        { name: "dataset", in: "query", schema: { type: "string", enum: ["logs"] } },
        { name: "field", in: "query", schema: { type: "array", items: { type: "string", enum: ["id", "timestamp"] } } },
        { name: "Accept", in: "header", schema: { type: "string" } },
      ],
      get: {
        operationId: "List an Organization's Events",
        summary: "Query events",
        description: "Select a dataset and the fields to return.",
        tags: ["Events"],
        parameters: [{ name: "dataset", in: "query", required: true, description: "Dataset to query", schema: { type: "string", enum: datasets } }],
        responses: { "200": { description: "Events" } },
      },
    },
  },
});

async function generate(spec: { paths: object }) {
  const directory = mkdtempSync(join(tmpdir(), "api-operations-"));
  try {
    const original = join(directory, "original.json");
    const normalized = join(directory, "normalized.json");
    writeFileSync(original, JSON.stringify(spec));
    normalizeSpec(original, normalized);
    await createClient({
      input: normalized,
      output: join(directory, "sdk"),
      plugins: ["@hey-api/typescript", "@hey-api/sdk"],
    });
    const source = readFileSync(join(directory, "sdk", "sdk.gen.ts"), "utf8");
    return { source, catalog: extractOperations(spec, source) };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("operation discovery", () => {
  test("preserves original metadata while following SDK naming, inheritance and API growth", async () => {
    const initial = await generate(fixture());
    expect(initial.catalog).toEqual([{
      functionName: "listOrganizationEvents",
      operationId: "List an Organization's Events",
      method: "GET",
      path: eventsPath,
      summary: "Query events",
      description: "Select a dataset and the fields to return.",
      tags: ["Events"],
      pathParameters: ["organization_id_or_slug"],
      queryParameters: [
        { name: "dataset", required: true, description: "Dataset to query", type: "string", enum: ["logs", "spans"] },
        { name: "field", required: false, type: "array", enum: ["id", "timestamp"] },
      ],
      deprecated: false,
      experimental: false,
      idempotent: true,
    }]);

    const next = fixture(["logs", "spans", "new_dataset"]);
    const newPath = "/new-capability/";
    const grown = await generate({
      ...next,
      paths: {
        ...next.paths,
        [newPath]: {
          post: { operationId: "queryNewCapability", deprecated: true, responses: { "200": { description: "Results" } } },
        },
      },
    });
    expect(grown.catalog).toHaveLength(2);
    expect(grown.catalog.find(operation => operation.path === newPath)).toMatchObject({
      functionName: "queryNewCapability", operationId: "queryNewCapability", method: "POST", deprecated: true,
      idempotent: false,
    });
    expect(grown.catalog.find(operation => operation.path === eventsPath)?.queryParameters[0]?.enum)
      .toEqual(["logs", "spans", "new_dataset"]);

    // Never silently publish a partial catalog or select one of two route matches.
    expect(() => extractOperations(next, grown.source)).toThrow("SDK operations missing from OpenAPI");
    expect(() => extractOperations({ paths: { ...next.paths, "/missing/": { get: {} } } }, initial.source))
      .toThrow("Missing SDK operation for GET /missing/");
    expect(() => extractOperations(next, initial.source + initial.source.replaceAll("listOrganizationEvents", "otherName")))
      .toThrow(`Multiple SDK operations for GET ${eventsPath}`);
  });

  test("marks non-safe methods idempotent only when Sentry declares it", async () => {
    const response = { responses: { "200": { description: "OK" } } };
    const { catalog } = await generate({
      ...fixture(),
      paths: {
        "/assemble/": { post: { operationId: "assemble", ...response, "x-sentry-idempotent": true } },
        "/things/": {
          post: { operationId: "createThing", ...response },
          put: { operationId: "updateThing", ...response },
          delete: { operationId: "deleteThing", ...response },
        },
      },
    });
    expect(Object.fromEntries(catalog.map(operation => [operation.functionName, operation.idempotent]))).toEqual({
      assemble: true, createThing: false, updateThing: false, deleteThing: false,
    });
  });

  test("marks operations experimental only when Sentry declares it", async () => {
    const response = { responses: { "200": { description: "OK" } } };
    const { catalog } = await generate({
      ...fixture(),
      paths: {
        "/things/": {
          get: { operationId: "listThings", ...response, "x-sentry-experimental": true },
          post: { operationId: "createThing", ...response },
        },
      },
    });
    expect(Object.fromEntries(catalog.map(operation => [operation.functionName, operation.experimental]))).toEqual({
      listThings: true, createThing: false,
    });
  });

  test("flags the same released operations that the SDK documents as experimental", () => {
    const experimental = operations.filter(operation => operation.experimental);
    expect(experimental.length).toBeGreaterThan(0);
    // Sentry's schema build adds this note to every operation it marks with x-sentry-experimental.
    const documented = operations.filter(operation => operation.description.startsWith("**Experimental:**"));
    expect(experimental.map(operation => operation.functionName)).toEqual(documented.map(operation => operation.functionName));
    const source = readFileSync(new URL("../src/sdk.gen.ts", import.meta.url), "utf8");
    expect(source.match(/\*\*Experimental:\*\*/g)).toHaveLength(experimental.length);
  });

  test.each([
    ["the server URL", "https://{region}.sentry.io/api/0", "/organizations/", "/api/0"],
    ["the paths, while Sentry's server URL lacks it", "https://{region}.sentry.io", "/api/0/organizations/", "/api/0"],
    ["a later API version", "https://{region}.sentry.io/api/1", "/organizations/", "/api/1"],
  ])("reads the API base path from %s", (_, url, path, basePath) => {
    const spec = { servers: [{ url }], paths: { [path]: { get: { servers: [{ url }] } } } };
    expect(splitApiBasePath(spec)).toBe(basePath);
    const origin = [{ url: "https://{region}.sentry.io" }];
    expect(spec).toEqual({ servers: origin, paths: { "/organizations/": { get: { servers: origin } } } });
  });

  test("ships one catalog entry for every actual standalone SDK export", () => {
    expect(operations.map(operation => operation.functionName).sort()).toEqual(Object.keys(sdk).sort());
    const original = JSON.parse(readFileSync(new URL("../spec/openapi-derefed.json", import.meta.url), "utf8"));
    expect(splitApiBasePath(original)).toBe(API_BASE_PATH);
    const source = readFileSync(new URL("../src/sdk.gen.ts", import.meta.url), "utf8");
    expect(operations).toEqual(extractOperations(original, source));
  });
});
