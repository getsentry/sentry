import { describe, expect, test } from "vitest";
import { API_BASE_PATH, createOperationMatcher, matchOperation, operations } from "@sentry/api/operations";

const orgIssues = "/organizations/{organization_id_or_slug}/issues/";

describe("matchOperation", () => {
  test("finds the catalog operation, its parameters and routing for a concrete path", () => {
    const match = matchOperation("GET", `${API_BASE_PATH}/organizations/acme/issues/`);
    expect(match?.operation).toBe(operations.find(operation => operation.method === "GET" && operation.path === orgIssues));
    expect(match?.operation.operationId).not.toBe("");
    expect(match?.operation.routing.silo).toBe("cell");
    expect(match?.params).toEqual({ organization_id_or_slug: "acme" });
  });

  test.each([
    ["relative to the base path", "/organizations/acme/issues/"],
    ["without a trailing slash", "/api/0/organizations/acme/issues"],
    ["with a query string and hash", "/api/0/organizations/acme/issues/?query=is:unresolved#top"],
    ["as a full URL", "https://us.sentry.io/api/0/organizations/acme/issues/"],
    ["under a self-hosted prefix", "/sentry/api/0/organizations/acme/issues/"],
    ["as a full URL under a self-hosted prefix", "https://sentry.example.com/sentry/api/0/organizations/acme/issues/"],
  ])("accepts a path %s", (_, path) => {
    expect(matchOperation("get", path)?.operation.path).toBe(orgIssues);
  });

  test("decodes parameter values", () => {
    expect(matchOperation("GET", "/organizations/my%20org/issues/")?.params).toEqual({ organization_id_or_slug: "my org" });
  });

  test("returns undefined for an unknown path or a method the template does not have", () => {
    expect(matchOperation("GET", "/api/0/not-an-endpoint/")).toBeUndefined();
    expect(matchOperation("TRACE", "/api/0/organizations/acme/issues/")).toBeUndefined();
  });

  test("prefers a literal segment in the shipped catalog", () => {
    const base = "/organizations/acme/preprodartifacts/snapshots";
    expect(matchOperation("GET", `${base}/latest-base/`)?.operation.path).toBe(
      "/organizations/{organization_id_or_slug}/preprodartifacts/snapshots/latest-base/",
    );
    expect(matchOperation("GET", `${base}/123/`)?.params).toEqual({ organization_id_or_slug: "acme", snapshot_id: "123" });
  });

  test("indexes every shipped operation without ambiguity", () => {
    for (const operation of operations) {
      const path = operation.path.replace(/\{[^}]+\}/g, "value");
      expect(matchOperation(operation.method, path)?.operation).toBe(operation);
    }
  });
});

describe("createOperationMatcher", () => {
  test("a literal segment wins over a parameter at the first segment where templates differ", () => {
    const match = createOperationMatcher([
      { method: "GET", path: "/teams/{team}/{view}/" },
      { method: "GET", path: "/teams/{team}/members/" },
      { method: "GET", path: "/teams/stats/{period}/" },
    ]);
    expect(match("GET", "/teams/backend/members/")?.operation.path).toBe("/teams/{team}/members/");
    expect(match("GET", "/teams/backend/settings/")?.params).toEqual({ team: "backend", view: "settings" });
    expect(match("GET", "/teams/stats/members/")?.operation.path).toBe("/teams/stats/{period}/");
  });

  test("falls back to a parameter when the literal branch has no match", () => {
    const match = createOperationMatcher([
      { method: "GET", path: "/teams/stats/" },
      { method: "GET", path: "/teams/{team}/members/" },
      { method: "POST", path: "/teams/stats/members/" },
    ]);
    expect(match("GET", "/teams/stats/members/")?.params).toEqual({ team: "stats" });
    expect(match("POST", "/teams/stats/members/")?.operation.path).toBe("/teams/stats/members/");
  });

  test("throws on its first use when templates for one method differ only in parameter names", () => {
    const match = createOperationMatcher([
      { method: "GET", path: "/teams/{team}/" },
      { method: "GET", path: "/teams/{team_id_or_slug}/" },
    ]);
    expect(() => match("GET", "/teams/backend/")).toThrow(
      "Ambiguous operation templates: GET /teams/{team}/ and GET /teams/{team_id_or_slug}/",
    );
  });

  test("strips the base path under a prefix for custom templates too", () => {
    const match = createOperationMatcher([{ method: "GET", path: "/" }, { method: "GET", path: "/teams/{team}/" }]);
    expect(match("GET", "/sentry/api/0/teams/backend/")?.params).toEqual({ team: "backend" });
    expect(match("GET", "https://sentry.example.com/sentry/api/0")?.operation.path).toBe("/");
  });

  test("keeps templates that differ only in method apart", () => {
    const match = createOperationMatcher([
      { method: "GET", path: "/teams/{team}/", id: "read" },
      { method: "DELETE", path: "/teams/{slug}/", id: "remove" },
    ]);
    expect(match("DELETE", "/teams/backend/")).toEqual({
      operation: { method: "DELETE", path: "/teams/{slug}/", id: "remove" },
      params: { slug: "backend" },
    });
  });
});
