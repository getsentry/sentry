import { describe, expect, test } from "vitest";
import { analyzeSourceApiUsage, type SourceApiOperation } from "../lib/source-analysis.ts";

const operations = [
  {
    functionName: "listOrganizationEvents",
    method: "GET",
    path: "/api/0/organizations/{organization_id_or_slug}/events/",
  },
  {
    functionName: "getOrganizationTrace",
    method: "GET",
    path: "/api/0/organizations/{organization_id_or_slug}/trace/{trace_id}/",
  },
  {
    functionName: "deleteProject",
    method: "DELETE",
    path: "/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/",
  },
] as const satisfies readonly SourceApiOperation[];

describe("consumer source analysis", () => {
  test("keeps configured tool factories separate from inspecting tools as data", () => {
    const sources = new Map([
      ["src/help.ts", `
        import { tools } from "./tools.js";
        export const help = defineTool({ run: () => inspect(tools) });
      `],
      ["src/tools.ts", `
        import { remove } from "./remove.js";
        export const tools = { remove };
      `],
      ["src/remove.ts", `
        import { deleteProject } from "@sentry/api";
        function customFactory(config) { return defineTool(config); }
        export const remove = customFactory({ requiresApproval: true, run: () => deleteProject({}) });
        export const alias = remove;
      `],
      ["src/cli.ts", `
        export const legacy = buildCommand({ destructive: true, run: () => apiRequestToRegion("region", "/organizations/example/events/") });
      `],
    ]);
    const analysis = analyzeSourceApiUsage(sources, operations, {
      boundaries: ["defineTool"],
      declarationFlags: ["requiresApproval"],
    });

    for (const [file, name] of [["src/help.ts", "help"], ["src/tools.ts", "tools"]] as const) {
      expect(analysis.exports.get(file)?.get(name)).toEqual({
        operations: [], unresolvedRequests: [], methods: [],
      });
    }
    for (const name of ["remove", "alias"]) {
      expect(analysis.exports.get("src/remove.ts")?.get(name)?.methods).toEqual(["DELETE"]);
      expect(analysis.boundaries).toContainEqual({
        file: "src/remove.ts", name, factories: ["defineTool"], flags: ["requiresApproval"],
      });
    }
    expect(analyzeSourceApiUsage(sources, operations).boundaries).toEqual([]);
    expect(analysis.exports.get("src/cli.ts")?.get("legacy")?.operations).toEqual([]);
  });

  test("follows helper aliases and barrels as consumer sources grow without an SDK change", () => {
    const sources = new Map([
      ["src/api.tsx", `
        import { listOrganizationEvents as events } from "@sentry/api";
        export const query = () => events({ query: { dataset: "logs", token: "do-not-collect" } });
      `],
      ["src/barrel.ts", `export { query as read } from "./api.js";`],
      ["src/list.ts", `
        import { read } from "./barrel.js";
        const customFactory = (config) => defineTool(config);
        export const tool = customFactory({ async run() { return await read(); } });
      `],
    ]);
    const options = { boundaries: ["defineTool"], queryParameters: ["dataset"] };
    const first = analyzeSourceApiUsage(sources, operations, options);
    expect(first.exports.get("src/list.ts")?.get("tool")?.operations).toEqual([
      { ...operations[0], query: { dataset: "logs" } },
    ]);
    expect(analyzeSourceApiUsage(sources, operations).exports.get("src/api.tsx")?.get("query")?.operations[0]?.query)
      .toBeUndefined();

    sources.set("src/api.tsx", `
      import { getOrganizationTrace as trace, listOrganizationEvents } from "@sentry/api";
      export const query = () => trace({ path: {} });
    `);
    sources.set("src/new.ts", `export * from "./list.js";`);
    const changed = analyzeSourceApiUsage(sources, operations, options);
    expect(changed.exports.get("src/new.ts")?.get("tool")?.operations.map(operation => operation.functionName))
      .toEqual(["getOrganizationTrace"]);
    expect(changed.boundaries).toContainEqual({
      file: "src/new.ts", name: "tool", factories: ["defineTool"], flags: [],
    });
  });

  test("recognizes configured request wrappers and retains known query terms", () => {
    const sources = new Map([
      ["src/read.ts", `
        import { regionalRequest as read } from "./transport.js";
        const DATASET = "spans";
        const TRANSACTIONS = "is_transaction:true";
        export function list(org, options) {
          const query = [TRANSACTIONS, options.query].filter(Boolean).join(" ");
          return read(options.region, \`/organizations/\${org}/events/\`, {
            params: { dataset: DATASET, query: query || undefined },
          });
        }
        export const remove = (org, project) => deleteRequest(\`/projects/\${org}/\${project}/\`);
      `],
    ]);
    const result = analyzeSourceApiUsage(sources, operations, {
      requests: [
        { functionName: "regionalRequest", pathArgument: 1, optionsArgument: 2, queryProperty: "params" },
        { functionName: "deleteRequest", pathArgument: 0, optionsArgument: 1, defaultMethod: "DELETE" },
      ],
      queryParameters: ["dataset", "query"],
    }).exports.get("src/read.ts")!;
    expect(result.get("list")).toEqual({
      operations: [{ ...operations[0], query: { dataset: "spans", query: "is_transaction:true" } }],
      unresolvedRequests: [], methods: ["GET"],
    });
    expect(result.get("remove")?.operations.map(operation => operation.functionName)).toEqual(["deleteProject"]);
    expect(result.get("remove")?.methods).toEqual(["DELETE"]);
    expect(analyzeSourceApiUsage(sources, operations).exports.get("src/read.ts")?.get("list")?.operations).toEqual([]);
  });

  test("reports dynamic, private and ambiguous requests without losing known HTTP methods", () => {
    const sources = new Map([
      ["src/requests.ts", `
        export const dynamic = (path) => request(path, { method: "DELETE" });
        export const privateApi = () => request("/private/", { method: "DELETE" });
        export const unknownMethod = (options) => request("/organizations/example/events/", { ...options });
        export const ambiguous = (org) => request(\`/organizations/\${org}/events/\`);
      `],
    ]);
    const result = analyzeSourceApiUsage(sources, [
      ...operations,
      { functionName: "otherEvents", method: "GET", path: "/api/0/organizations/{org}/events/" },
    ], {
      requests: [{ functionName: "request", pathArgument: 0, optionsArgument: 1 }],
    }).exports.get("src/requests.ts")!;
    expect(result.get("dynamic")).toMatchObject({
      methods: ["DELETE"], operations: [],
      unresolvedRequests: [{ method: "DELETE", reason: "Dynamic request identity" }],
    });
    expect(result.get("privateApi")).toMatchObject({
      methods: ["DELETE"], operations: [],
      unresolvedRequests: [{ method: "DELETE", reason: "Request is not in the public catalog" }],
    });
    expect(result.get("unknownMethod")).toMatchObject({
      methods: [], operations: [],
      unresolvedRequests: [{ reason: "Dynamic request identity" }],
    });
    expect(result.get("ambiguous")).toMatchObject({
      methods: ["GET"], operations: [],
      unresolvedRequests: [{ reason: "Ambiguous catalog path" }],
    });
  });

  test("keeps SDK callbacks conservative without following unused imports, shadowed bindings or factory internals", () => {
    const sources = new Map([
      ["src/factory.ts", `
        import { deleteProject } from "@sentry/api";
        export const defineTool = (config) => { deleteProject({}); return config; };
      `],
      ["src/project.ts", `
        import { defineTool } from "./factory.js";
        import * as sdk from "@sentry/api";
        import { deleteProject } from "@sentry/api";
        export const remove = defineTool({ approved: true, unrelated: true, run: () => [].map(sdk.deleteProject) });
        export const safe = defineTool({ approved: false, run: (deleteProject) => deleteProject() });
      `],
    ]);
    const analysis = analyzeSourceApiUsage(sources, operations, {
      boundaries: ["defineTool"], declarationFlags: ["approved"],
    });
    expect(analysis.exports.get("src/project.ts")?.get("remove")).toEqual({
      operations: [operations[2]], unresolvedRequests: [], methods: ["DELETE"],
    });
    expect(analysis.exports.get("src/project.ts")?.get("safe")).toEqual({
      operations: [], unresolvedRequests: [], methods: [],
    });
    expect(analysis.boundaries).toContainEqual({
      file: "src/project.ts", name: "remove", factories: ["defineTool"], flags: ["approved"],
    });
    expect(analysis.boundaries).toContainEqual({
      file: "src/project.ts", name: "safe", factories: ["defineTool"], flags: [],
    });
  });

  test("does not invent query context when an unknown trailing spread can override it", () => {
    const sources = new Map([
      ["src/queries.ts", `
        import { listOrganizationEvents } from "@sentry/api";
        const page = { per_page: 10 };
        export const unknown = (options) => listOrganizationEvents({ query: { dataset: "logs", ...options } });
        export const explicit = (options) => listOrganizationEvents({ query: { ...options, dataset: "logs" } });
        export const known = () => listOrganizationEvents({ query: { dataset: "logs", ...page } });
      `],
    ]);
    const result = analyzeSourceApiUsage(sources, operations, {
      queryParameters: ["dataset"],
    }).exports.get("src/queries.ts")!;
    expect(result.get("unknown")?.operations[0]?.query).toBeUndefined();
    expect(result.get("explicit")?.operations[0]?.query).toEqual({ dataset: "logs" });
    expect(result.get("known")?.operations[0]?.query).toEqual({ dataset: "logs" });
  });
});
