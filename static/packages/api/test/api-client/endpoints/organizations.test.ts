import { describe, expect, it } from "vitest";
import * as v from "valibot";
import { z } from "zod";
import {
  jsonResponse,
  nextLink,
  ORIGIN,
  scriptedTarget,
} from "../support.ts";
import { ApiResponseValidationError } from "@sentry/api/client";
import {
  getAuthenticatedUser,
  getOrganization,
  listOrganizations,
  updateAgenticOnboardingStatus,
} from "../../../src/api-client/endpoints/organizations.ts";

const OrganizationZod = z.object({ slug: z.string() });
const OrganizationValibot = v.object({ slug: v.string() });

describe("getAuthenticatedUser", () => {
  it("reads /auth/ and returns the host schema's output", async () => {
    const { apiTarget, request } = scriptedTarget(
      jsonResponse({ id: "1", email: "jane@example.com", extra: true }),
    );

    const user = await getAuthenticatedUser(
      apiTarget,
      z.object({ id: z.string(), email: z.string() }),
    );

    expect(user).toEqual({ id: "1", email: "jane@example.com" });
    expect(request.mock.calls[0]?.[0]).toBe(`${ORIGIN}/api/0/auth/`);
  });

  it("throws the shared validation error for a mismatched body", async () => {
    const { apiTarget } = scriptedTarget(jsonResponse({ id: 1 }));

    await expect(
      getAuthenticatedUser(apiTarget, z.object({ id: z.string() })),
    ).rejects.toBeInstanceOf(ApiResponseValidationError);
  });
});

describe("getOrganization", () => {
  it.each([
    [{}, ""],
    [{ includeFeatureFlags: true }, "?include_feature_flags=1"],
    [{ detailed: false }, "?detailed=0"],
    [{ detailed: true }, ""],
  ])("sends %o as %s", async (params, query) => {
    const { apiTarget, request } = scriptedTarget(
      jsonResponse({ slug: "acme" }),
    );

    await getOrganization(
      apiTarget,
      { organizationSlug: "acme", ...params },
      OrganizationZod,
    );

    expect(request.mock.calls[0]?.[0]).toBe(
      `${ORIGIN}/api/0/organizations/acme/${query}`,
    );
  });

  it("encodes the slug as a path segment", async () => {
    const { apiTarget, request } = scriptedTarget(
      jsonResponse({ slug: "a/b" }),
    );

    await getOrganization(
      apiTarget,
      { organizationSlug: "a/b" },
      OrganizationValibot,
    );

    expect(request.mock.calls[0]?.[0]).toBe(
      `${ORIGIN}/api/0/organizations/a%2Fb/`,
    );
  });
});

describe("listOrganizations", () => {
  it("follows next cursors until it has the limit", async () => {
    const { apiTarget, request } = scriptedTarget(
      jsonResponse(
        [{ slug: "a" }, { slug: "b" }],
        nextLink("/organizations/", "0:2:0"),
      ),
      jsonResponse([{ slug: "c" }], nextLink("/organizations/", "0:3:0")),
    );

    const page = await listOrganizations(
      apiTarget,
      { query: "ac", limit: 3 },
      z.array(OrganizationZod),
    );

    expect(page).toEqual({
      items: [{ slug: "a" }, { slug: "b" }, { slug: "c" }],
      nextCursor: "0:3:0",
    });
    const urls = request.mock.calls.map(([url]) => new URL(url));
    expect(urls.map((url) => url.pathname)).toEqual([
      "/api/0/organizations/",
      "/api/0/organizations/",
    ]);
    expect(urls[0]?.searchParams.get("per_page")).toBe("3");
    expect(urls[0]?.searchParams.get("query")).toBe("ac");
    expect(urls[1]?.searchParams.get("per_page")).toBe("3");
    expect(urls[1]?.searchParams.get("cursor")).toBe("0:2:0");
  });

  it("returns no cursor once the server has no next page", async () => {
    const { apiTarget } = scriptedTarget(jsonResponse([{ slug: "a" }]));

    const page = await listOrganizations(
      apiTarget,
      {},
      v.array(OrganizationValibot),
    );

    expect(page).toEqual({ items: [{ slug: "a" }], nextCursor: null });
  });

  it("starts from the given cursor", async () => {
    const { apiTarget, request } = scriptedTarget(jsonResponse([]));

    await listOrganizations(
      apiTarget,
      { cursor: "0:25:0" },
      z.array(OrganizationZod),
    );

    expect(
      new URL(request.mock.calls[0]?.[0] ?? "").searchParams.get("cursor"),
    ).toBe("0:25:0");
  });
});

describe("updateAgenticOnboardingStatus", () => {
  it("posts the update as the body", async () => {
    const { apiTarget, request } = scriptedTarget(jsonResponse({ id: "1" }));

    await updateAgenticOnboardingStatus(
      apiTarget,
      { organizationSlug: "acme", update: { step: "done" } },
      z.object({ id: z.string() }),
    );

    const [url, init] = request.mock.calls[0] ?? [];
    expect(url).toBe(
      `${ORIGIN}/api/0/organizations/acme/onboarding/agent/status/`,
    );
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ step: "done" }));
  });
});
