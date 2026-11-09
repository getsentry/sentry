import { describe, expect, test } from "vitest";
import { analyzeSourceApiUsage, type SourceApiOperation } from "../lib/source-analysis.ts";

const operations = [
  { functionName: "deleteProject", method: "DELETE", path: "/api/0/projects/{org}/{project}/" },
  { functionName: "listOrganizations", method: "GET", path: "/api/0/organizations/" },
] as const satisfies readonly SourceApiOperation[];
const helper = `import { deleteProject } from "@sentry/api"; export const read = () => deleteProject({});`;

describe("source analysis modules", () => {
  test.each([
    ["./helper.js", "src/helper.ts"],
    ["./helper.js", "src/helper.tsx"],
    ["./helper.ts", "src/helper.ts"],
    ["./helper.tsx", "src/helper.tsx"],
    ["./helper", "src/helper.ts"],
    ["./helper", "src/helper.tsx"],
    ["./helper", "src/helper/index.ts"],
    ["./helper", "src/helper/index.tsx"],
  ] as const)("follows %s to supplied source %s", (specifier, file) => {
    const sources = new Map([
      [file, helper],
      ["src/main.ts", `import { read } from "${specifier}"; export const run = () => read();`],
    ]);

    expect(analyzeSourceApiUsage(sources, operations).exports.get("src/main.ts")?.get("run"))
      .toEqual({ operations: [operations[0]], unresolvedRequests: [], methods: ["DELETE"] });
  });

  test.each([
    ["exact source", ["src/helper", "src/helper.ts", "src/helper.tsx", "src/helper/index.ts", "src/helper/index.tsx"]],
    [".ts file", ["src/helper.ts", "src/helper.tsx", "src/helper/index.ts", "src/helper/index.tsx"]],
    [".tsx file", ["src/helper.tsx", "src/helper/index.ts", "src/helper/index.tsx"]],
    ["index.ts file", ["src/helper/index.ts", "src/helper/index.tsx"]],
  ] as const)("prefers the %s over later relative module candidates", (_name, files) => {
    const sources = new Map<string, string>(files.map((file, index) => [file, index === 0 ? helper : `
      import { listOrganizations } from "@sentry/api";
      export const read = () => listOrganizations({});
    `]));
    sources.set("src/main.ts", `import { read } from "./helper"; export const run = () => read();`);

    expect(analyzeSourceApiUsage(sources, operations).exports.get("src/main.ts")?.get("run")?.operations)
      .toEqual([operations[0]]);
  });

  test.each([
    [".ts source", ["src/helper.ts", "src/helper.tsx", "src/helper.js"]],
    [".tsx source", ["src/helper.tsx", "src/helper.js"]],
    ["exact .js fallback", ["src/helper.js"]],
  ] as const)("uses the %s for a .js import", (_name, files) => {
    const sources = new Map<string, string>(files.map((file, index) => [file, index === 0 ? helper : `
      import { listOrganizations } from "@sentry/api";
      export const read = () => listOrganizations({});
    `]));
    sources.set("src/main.ts", `import { read } from "./helper.js"; export const run = () => read();`);

    expect(analyzeSourceApiUsage(sources, operations).exports.get("src/main.ts")?.get("run")?.operations)
      .toEqual([operations[0]]);
  });

  test.each([
    ["./helper.js", ["src/helper.js/index.ts", "src/helper.ts/index.ts"]],
    ["./helper.ts", ["src/helper.tsx", "src/helper.ts/index.ts"]],
    ["./helper.tsx", ["src/helper.tsx/index.ts"]],
  ] as const)("does not broaden explicit %s to another extension or a directory", (specifier, files) => {
    const sources = new Map<string, string>(files.map(file => [file, helper]));
    sources.set("src/main.ts", `import { read } from "${specifier}"; export const run = () => read();`);

    expect(analyzeSourceApiUsage(sources, operations).exports.get("src/main.ts")?.get("run")?.operations)
      .toEqual([]);
  });

  test.each([
    ["named function", `export default function read() { return deleteProject({}); }`],
    ["anonymous function", `export default function () { return deleteProject({}); }`],
    ["arrow expression", `export default () => deleteProject({});`],
    ["identifier expression", `const read = () => deleteProject({}); export default read;`],
    ["export alias", `const read = () => deleteProject({}); export { read as default };`],
  ] as const)("follows a default import using %s without exposing private names", (_name, declaration) => {
    const sources = new Map([
      ["src/helper.ts", `import { deleteProject } from "@sentry/api"; ${declaration}`],
      ["src/main.ts", `import read from "./helper.js"; export const run = () => read();`],
    ]);
    const analysis = analyzeSourceApiUsage(sources, operations);

    expect([...analysis.exports.get("src/helper.ts")!.keys()]).toEqual(["default"]);
    for (const [file, name] of [["src/helper.ts", "default"], ["src/main.ts", "run"]] as const) {
      expect(analysis.exports.get(file)?.get(name))
        .toEqual({ operations: [operations[0]], unresolvedRequests: [], methods: ["DELETE"] });
    }
  });

  test("keeps the named default function available to local callers", () => {
    const sources = new Map([["src/helper.ts", `
      import { deleteProject } from "@sentry/api";
      export default function remove() { return deleteProject({}); }
      export const internal = () => remove();
    `]]);
    const exports = analyzeSourceApiUsage(sources, operations).exports.get("src/helper.ts")!;

    expect([...exports.keys()]).toEqual(["default", "internal"]);
    expect(exports.get("internal")?.operations).toEqual([operations[0]]);
  });

  test("follows default re-exports and namespace access while export star forwards only named exports", () => {
    const sources = new Map([
      ["src/helper.ts", `
        import { deleteProject, listOrganizations } from "@sentry/api";
        export default function remove() { return deleteProject({}); }
        export const list = () => listOrganizations({});
      `],
      ["src/barrel.ts", `export { default, default as remove } from "./helper.js";`],
      ["src/star.ts", `export * from "./helper.js";`],
      ["src/main.ts", `
        import remove, { list } from "./helper.js";
        import forwarded, { remove as named } from "./barrel.js";
        import * as sdk from "./helper.js";
        import missing from "./star.js";
        import * as star from "./star.js";
        export const fromNamespace = () => sdk.default();
        export const fromDefaultReexport = () => forwarded();
        export const fromNamedReexport = () => named();
        export const mixed = () => { remove(); list(); };
        export const missingDefault = () => missing();
        export const missingNamespace = () => star.default();
      `],
    ]);
    const analysis = analyzeSourceApiUsage(sources, operations);

    expect([...analysis.exports.get("src/star.ts")!.keys()]).toEqual(["list"]);
    expect(analysis.exports.get("src/star.ts")?.get("list")?.operations).toEqual([operations[1]]);
    for (const name of ["fromNamespace", "fromDefaultReexport", "fromNamedReexport"]) {
      expect(analysis.exports.get("src/main.ts")?.get(name)?.operations).toEqual([operations[0]]);
    }
    expect(analysis.exports.get("src/main.ts")?.get("mixed")?.operations).toEqual([...operations]);
    for (const name of ["missingDefault", "missingNamespace"]) {
      expect(analysis.exports.get("src/main.ts")?.get(name)?.operations).toEqual([]);
    }
  });

  test("preserves a default boundary alias without attributing its callbacks to data consumers", () => {
    const sources = new Map([
      ["src/remove.ts", `
        import { deleteProject } from "@sentry/api";
        const remove = defineTool({ run: () => deleteProject({}) });
        export default remove;
      `],
      ["src/main.ts", `
        import remove from "./remove.js";
        export const alias = remove;
        export const tools = { remove };
        export const help = defineTool({ run: () => inspect(tools) });
      `],
    ]);
    const analysis = analyzeSourceApiUsage(sources, operations, { boundaries: ["defineTool"] });

    for (const [file, name] of [["src/remove.ts", "default"], ["src/main.ts", "alias"]] as const) {
      expect(analysis.exports.get(file)?.get(name)?.operations).toEqual([operations[0]]);
      expect(analysis.boundaries).toContainEqual({ file, name, factories: ["defineTool"], flags: [] });
    }
    for (const name of ["tools", "help"]) {
      expect(analysis.exports.get("src/main.ts")?.get(name)?.operations).toEqual([]);
    }
  });

  test("stops at a cycle of default identifier exports", () => {
    const sources = new Map([
      ["src/a.ts", `import reference from "./b.js"; export default reference;`],
      ["src/b.ts", `import reference from "./a.js"; export default reference;`],
      ["src/main.ts", `import reference from "./a.js"; export const run = () => reference();`],
    ]);

    expect(analyzeSourceApiUsage(sources, operations).exports.get("src/main.ts")?.get("run"))
      .toEqual({ operations: [], unresolvedRequests: [], methods: [] });
  });
});

describe.each(["identifier expression", "export alias"] as const)("default callable identity through %s", form => {
  const exportDefault = (name: string) => form === "identifier expression"
    ? `export default ${name};`
    : `export { ${name} as default };`;

  test("retains configured request identity and reads arguments at each callsite", () => {
    const sources = new Map([
      ["src/request.ts", `
        function apiRequest(path, options) { return transport(path, options); }
        ${exportDefault("apiRequest")}
      `],
      ["src/main.ts", `
        import request from "./request.js";
        export const list = () => request("/organizations/", { method: "GET", query: { cursor: "page-2" } });
        export const dynamic = (path) => request(path, { method: "DELETE" });
      `],
    ]);
    const result = analyzeSourceApiUsage(sources, operations, {
      requests: [{ functionName: "apiRequest", pathArgument: 0, optionsArgument: 1 }],
      queryParameters: ["cursor"],
    }).exports.get("src/main.ts")!;

    expect(result.get("list")).toEqual({
      operations: [{ ...operations[1], query: { cursor: "page-2" } }],
      unresolvedRequests: [], methods: ["GET"],
    });
    expect(result.get("dynamic")).toMatchObject({
      operations: [], methods: ["DELETE"],
      unresolvedRequests: [{ method: "DELETE", reason: "Dynamic request identity" }],
    });
  });

  test("recognizes a configured factory without leaking callbacks into data consumers", () => {
    const sources = new Map([
      ["src/factory.ts", `
        function defineTool(config) { return config; }
        ${exportDefault("defineTool")}
      `],
      ["src/main.ts", `
        import create from "./factory.js";
        import { deleteProject } from "@sentry/api";
        export const remove = create({ approved: true, run: () => deleteProject({}) });
        export const tools = { remove };
        export const help = create({ run: () => inspect(tools) });
      `],
    ]);
    const analysis = analyzeSourceApiUsage(sources, operations, {
      boundaries: ["defineTool"], declarationFlags: ["approved"],
    });

    expect(analysis.exports.get("src/main.ts")?.get("remove")?.operations).toEqual([operations[0]]);
    expect(analysis.boundaries).toContainEqual({
      file: "src/main.ts", name: "remove", factories: ["defineTool"], flags: ["approved"],
    });
    for (const name of ["tools", "help"]) {
      expect(analysis.exports.get("src/main.ts")?.get(name)?.operations).toEqual([]);
    }
  });

  test("retains SDK query context through a forwarded default import", () => {
    const sources = new Map([
      ["src/operation.ts", `
        import { listOrganizations as request } from "@sentry/api";
        ${exportDefault("request")}
      `],
      ["src/forward.ts", `export { default } from "./operation.js";`],
      ["src/main.ts", `
        import request from "./forward.js";
        export const list = () => request({ query: { cursor: "page-2" } });
      `],
    ]);
    const analysis = analyzeSourceApiUsage(sources, operations, { queryParameters: ["cursor"] });

    expect(analysis.exports.get("src/main.ts")?.get("list")?.operations)
      .toEqual([{ ...operations[1], query: { cursor: "page-2" } }]);
    if (form === "identifier expression") {
      for (const file of ["src/operation.ts", "src/forward.ts"]) {
        expect(analysis.exports.get(file)?.get("default")?.operations).toEqual([operations[1]]);
      }
    }
  });
});
