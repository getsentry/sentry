import { describe, expect, test } from "vitest";
import { analyzeSourceApiUsage, type SourceApiOperation } from "../lib/source-analysis.ts";

const operations = [
  {
    functionName: "deleteProject",
    method: "DELETE",
    path: "/projects/{organization_id_or_slug}/{project_id_or_slug}/",
  },
  {
    functionName: "listOrganizationEvents",
    method: "GET",
    path: "/organizations/{organization_id_or_slug}/events/",
  },
] as const satisfies readonly SourceApiOperation[];

describe("source analysis bindings", () => {
  test.each([
    ["namespace parameter", `export function run(sdk) { return sdk.deleteProject({}); }`],
    ["local namespace variable", `
      export function run() {
        const sdk = { deleteProject: () => undefined };
        return sdk.deleteProject({});
      }
    `],
    ["destructured parameter", `export function run({ deleteProject }) { return deleteProject({}); }`],
    ["destructured local variable", `
      export function run() {
        const { deleteProject } = { deleteProject: () => undefined };
        return deleteProject({});
      }
    `],
    ["local function", `
      export function run() {
        function deleteProject() {}
        return deleteProject({});
      }
    `],
  ] as const)("does not attribute SDK operations through a shadowing %s", (_name, declaration) => {
    const sources = new Map([["src/run.ts", `
      import * as sdk from "@sentry/api";
      import { deleteProject } from "@sentry/api";
      ${declaration}
    `]]);

    expect(analyzeSourceApiUsage(sources, operations).exports.get("src/run.ts")?.get("run"))
      .toEqual({ operations: [], unresolvedRequests: [], methods: [] });
  });

  test("follows an unshadowed SDK namespace", () => {
    const sources = new Map([["src/run.ts", `
      import * as sdk from "@sentry/api";
      export function run() { return sdk.deleteProject({}); }
    `]]);

    expect(analyzeSourceApiUsage(sources, operations).exports.get("src/run.ts")?.get("run"))
      .toEqual({ operations: [operations[0]], unresolvedRequests: [], methods: ["DELETE"] });
  });

  test.each([
    ["parameter", `export function run({ dataset }) { return listOrganizationEvents({ query: { dataset } }); }`],
    ["local variable", `
      export function run(options) {
        const { dataset } = options;
        return listOrganizationEvents({ query: { dataset } });
      }
    `],
  ] as const)("does not read an outer constant through a destructured %s", (_name, declaration) => {
    const sources = new Map([["src/run.ts", `
      import { listOrganizationEvents } from "@sentry/api";
      const dataset = "logs";
      ${declaration}
    `]]);

    expect(analyzeSourceApiUsage(sources, operations, { queryParameters: ["dataset"] })
      .exports.get("src/run.ts")?.get("run"))
      .toEqual({ operations: [operations[1]], unresolvedRequests: [], methods: ["GET"] });
  });

  test("distinguishes a private local name from an exported alias with the same name", () => {
    const sources = new Map([
      ["src/project.ts", `
        import { deleteProject, listOrganizationEvents } from "@sentry/api";
        const remove = () => deleteProject({});
        const list = () => listOrganizationEvents({});
        export const internal = () => remove();
        export { list as remove };
      `],
      ["src/barrel.ts", `export { remove } from "./project.js";`],
      ["src/forward.ts", `import { remove } from "./barrel.js"; export { remove };`],
      ["src/consumer.ts", `
        import { remove } from "./project.js";
        import { remove as read } from "./barrel.js";
        import { remove as forwarded } from "./forward.js";
        export const direct = () => remove();
        export const throughBarrel = () => read();
        export const throughLocalExport = () => forwarded();
      `],
    ]);
    const analysis = analyzeSourceApiUsage(sources, operations);

    expect(analysis.exports.get("src/project.ts")?.get("internal"))
      .toEqual({ operations: [operations[0]], unresolvedRequests: [], methods: ["DELETE"] });
    for (const [file, name] of [
      ["src/project.ts", "remove"],
      ["src/barrel.ts", "remove"],
      ["src/forward.ts", "remove"],
      ["src/consumer.ts", "direct"],
      ["src/consumer.ts", "throughBarrel"],
      ["src/consumer.ts", "throughLocalExport"],
    ] as const) {
      expect(analysis.exports.get(file)?.get(name))
        .toEqual({ operations: [operations[1]], unresolvedRequests: [], methods: ["GET"] });
    }
  });
});
