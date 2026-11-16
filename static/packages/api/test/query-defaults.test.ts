import { describe, expect, test } from "vitest";
import {
  createSentryClient,
  getOrganizationIssueEvent,
  getProjectEvent,
  narrowError_getOrganizationIssueEvent,
  narrowError_getProjectEvent,
  type Config,
  type GetOrganizationIssueEventQueryCollapse,
} from "@sentry/api";
import { applyQueryDefaults } from "../lib/query-defaults.mjs";

const asFetch = (implementation: (request: Request) => Promise<Response>) =>
  ((input: RequestInfo | URL, init?: RequestInit) =>
    implementation(new Request(input, init))) as NonNullable<Config["fetch"]>;

function recordingClient() {
  const queries: string[] = [];
  const fetch = asFetch(async request => {
    queries.push(new URL(request.url).search);
    return Response.json({});
  });
  return { queries, fetch, sentry: createSentryClient({ baseUrl: "https://example.test", fetch }) };
}

const event = { path: { organization_id_or_slug: "org", issue_id: "1", event_id: "latest" as const } };
const projectEvent = {
  path: { organization_id_or_slug: "org", project_id_or_slug: "project", event_id: "a".repeat(32) },
};
// The server also honors values the schema does not document yet, such as
// fullRelease. JavaScript callers can pass them; TypeScript callers need a cast.
const fullRelease = "fullRelease" as GetOrganizationIssueEventQueryCollapse;

describe("client-side query defaults", () => {
  test("skips adjacent-event lookups unless the caller sets collapse", async () => {
    const { queries, fetch, sentry } = recordingClient();
    const { getOrganizationIssueEvent: detached } = sentry;

    await sentry.getOrganizationIssueEvent(event);
    await detached({ ...event, query: { environment: ["prod"] } });
    await getOrganizationIssueEvent({ ...event, baseUrl: "https://example.test", fetch });
    await narrowError_getOrganizationIssueEvent({ ...event, client: sentry.client });
    // `undefined` behaves like an omitted parameter, as with JS default arguments.
    await sentry.getOrganizationIssueEvent({ ...event, query: { collapse: undefined } });

    expect(queries).toEqual([
      "?collapse=adjacentEvents",
      "?environment=prod&collapse=adjacentEvents",
      "?collapse=adjacentEvents",
      "?collapse=adjacentEvents",
      "?collapse=adjacentEvents",
    ]);
  });

  test("skips adjacent-event lookups on project events unless the caller sets collapse", async () => {
    const { queries, fetch, sentry } = recordingClient();

    await sentry.getProjectEvent(projectEvent);
    await sentry.getProjectEvent({ ...projectEvent, query: { environment: ["prod"] } });
    await getProjectEvent({ ...projectEvent, baseUrl: "https://example.test", fetch });
    await narrowError_getProjectEvent({ ...projectEvent, client: sentry.client });
    await sentry.getProjectEvent({ ...projectEvent, query: { collapse: [] } });

    expect(queries).toEqual([
      "?collapse=adjacentEvents",
      "?environment=prod&collapse=adjacentEvents",
      "?collapse=adjacentEvents",
      "?collapse=adjacentEvents",
      "",
    ]);
  });

  test("lets callers replace, combine, or opt out of the default", async () => {
    const { queries, sentry } = recordingClient();
    const query = { collapse: [] as GetOrganizationIssueEventQueryCollapse[], environment: ["prod"] };

    await sentry.getOrganizationIssueEvent({ ...event, query });
    await sentry.getOrganizationIssueEvent({ ...event, query: { collapse: [fullRelease] } });
    await sentry.getOrganizationIssueEvent({ ...event, query: { collapse: ["adjacentEvents", fullRelease] } });

    expect(queries).toEqual([
      "?environment=prod",
      "?collapse=fullRelease",
      "?collapse=adjacentEvents&collapse=fullRelease",
    ]);
    // The caller's options object is not mutated.
    expect(query).toEqual({ collapse: [], environment: ["prod"] });
  });

  test("leaves other operations unchanged", async () => {
    const { queries, sentry } = recordingClient();

    await sentry.listOrganizationIssueEvents({ path: { organization_id_or_slug: "org", issue_id: "1" } });
    await sentry.listOrganizations({ query: { owner: true } });

    expect(queries).toEqual(["", "?owner=true"]);
  });
});

describe("query default generator", () => {
  const route = "GET /api/0/things/{id}/";
  const spec = (schema: object) => ({
    paths: { "/api/0/things/{id}/": { get: { parameters: [{ name: "collapse", in: "query", schema }] } } },
  });
  const arrayEnum = { type: "array", items: { type: "string", enum: ["a", "b"] } };
  const source = [
    "/**",
    " * Get a thing",
    " */",
    "export const getThing = (options: Options<GetThingData>) => (options.client ?? client).get({",
    "    url: '/api/0/things/{id}/',",
    "    ...options",
    "});",
    "export const listThings = (options: Options<ListThingsData>) => (options.client ?? client).get({",
    "    url: '/api/0/things/',",
    "    ...options",
    "});",
    "",
  ].join("\n");
  const defaults = (values: unknown[], target = route) =>
    new Map([[target, { query: { collapse: values }, effect: "skips work" }]]);

  test("rewrites only the configured operation and documents the opt-out", () => {
    const output = applyQueryDefaults(spec(arrayEnum), source, defaults(["a"]));
    expect(output).toBe(source
      .replace(" * Get a thing\n", " * Get a thing\n *\n * By default, the SDK sends `collapse: [\"a\"]`, which skips work." +
        " Passing the parameter replaces the default; `collapse: []` sends none.\n")
      .replace("    ...options\n});\nexport const listThings",
        "    ...options,\n    query: { ...options?.query, \"collapse\": options?.query?.[\"collapse\"] ?? [\"a\"] }\n});\nexport const listThings"));
  });

  test("fails the build when the schema or SDK no longer matches", () => {
    expect(() => applyQueryDefaults(spec(arrayEnum), source, defaults(["c"])))
      .toThrow("must be a non-empty list of documented values");
    expect(() => applyQueryDefaults(spec(arrayEnum), source, defaults([])))
      .toThrow("must be a non-empty list of documented values");
    expect(() => applyQueryDefaults(spec({ type: "string", enum: ["a"] }), source, defaults(["a"])))
      .toThrow("is not an array enum parameter");
    expect(() => applyQueryDefaults(spec(arrayEnum), source, defaults(["a"], "GET /api/0/missing/")))
      .toThrow("Query default for missing operation: GET /api/0/missing/");
    expect(() => applyQueryDefaults(spec(arrayEnum), source.replace("'/api/0/things/{id}/'", "'/api/0/other/'"), defaults(["a"])))
      .toThrow(`Query defaults for missing SDK operations: ${route}`);
  });
});
