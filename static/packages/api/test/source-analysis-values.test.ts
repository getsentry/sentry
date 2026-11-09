import { describe, expect, test } from "vitest";
import { analyzeSourceApiUsage, type SourceApiOperation } from "../lib/source-analysis.ts";

const operation = {
  functionName: "listOrganizationEvents",
  method: "GET",
  path: "/api/0/organizations/{organization_id_or_slug}/events/",
} as const satisfies SourceApiOperation;

describe("source analysis value certainty", () => {
  test.each([
    ["unknown shorthand", "{ FIELD }", false],
    ["unknown shorthand spread", "{ FIELD: VALUE, ...{ FIELD } }", false],
    ["unknown computed override", "{ FIELD: VALUE, [key]: value }", false],
    ["accessor", "{ get FIELD() { return VALUE; } }", false],
    ["unknown trailing spread", "{ FIELD: VALUE, ...unknown }", false],
    ["explicit value after computed key", "{ [key]: value, FIELD: VALUE }", true],
    ["explicit value after spread", "{ ...unknown, FIELD: VALUE }", true],
  ] as const)("preserves method and query certainty for %s", (_, expression, known) => {
    const method = expression.replaceAll("FIELD", "method").replaceAll("VALUE", '"GET"');
    const query = expression.replaceAll("FIELD", "dataset").replaceAll("VALUE", '"logs"');
    const sources = new Map([["source.ts", `
      import { listOrganizationEvents } from "@sentry/api";
      export function raw(org, method, key, value, unknown) {
        return request(\`/organizations/\${org}/events/\`, ${method});
      }
      export function sdk(dataset, key, value, unknown) {
        return listOrganizationEvents({ query: ${query} });
      }
    `]]);
    const exports = analyzeSourceApiUsage(sources, [operation], {
      requests: [{ functionName: "request", pathArgument: 0, optionsArgument: 1 }],
      queryParameters: ["dataset"],
    }).exports.get("source.ts")!;

    expect(exports.get("raw")?.operations).toEqual(known ? [operation] : []);
    expect(exports.get("raw")?.unresolvedRequests).toEqual(known ? [] : [
      expect.objectContaining({ method: undefined, reason: "Dynamic request identity" }),
    ]);
    expect(exports.get("sdk")?.operations).toEqual([
      { ...operation, query: known ? { dataset: "logs" } : undefined },
    ]);
  });

  test.each(["let", "var", "const"] as const)("keeps %s binding values conservative", (kind) => {
    const mutable = kind !== "const";
    const sources = new Map([["source.ts", `
      import { listOrganizationEvents } from "@sentry/api";
      export function raw(org, next) {
        ${kind} method = "GET";
        ${mutable ? "method = next;" : ""}
        return request(\`/organizations/\${org}/events/\`, { method });
      }
      export function sdk(next) {
        ${kind} dataset = "logs";
        ${mutable ? "dataset = next;" : ""}
        return listOrganizationEvents({ query: { dataset } });
      }
    `]]);
    const exports = analyzeSourceApiUsage(sources, [operation], {
      requests: [{ functionName: "request", pathArgument: 0, optionsArgument: 1 }],
      queryParameters: ["dataset"],
    }).exports.get("source.ts")!;

    expect(exports.get("raw")?.operations).toEqual(mutable ? [] : [operation]);
    expect(exports.get("raw")?.unresolvedRequests).toEqual(mutable ? [
      expect.objectContaining({ method: undefined, reason: "Dynamic request identity" }),
    ] : []);
    expect(exports.get("sdk")?.operations).toEqual([
      { ...operation, query: mutable ? undefined : { dataset: "logs" } },
    ]);
  });

  test.each([
    ["false override", "{ approved: true, ...{ approved: false } }", []],
    ["unknown override", "{ approved: true, ...unknown }", []],
    ["explicit final true", "{ ...unknown, approved: true }", ["approved"]],
  ] as const)("respects declaration flag precedence in the same object for %s", (_, config, flags) => {
    const sources = new Map([["source.ts", `
      export const tool = (unknown) => defineTool(${config});
    `]]);
    const analysis = analyzeSourceApiUsage(sources, [operation], {
      boundaries: ["defineTool"],
      declarationFlags: ["approved"],
    });
    expect(analysis.boundaries).toEqual([
      { file: "source.ts", name: "tool", factories: ["defineTool"], flags: [...flags] },
    ]);
  });
});
