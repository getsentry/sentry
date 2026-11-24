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
import { createTeam, listTeams } from "../../../src/api-client/endpoints/teams.ts";

const TeamZod = z.object({ slug: z.string() });

describe("listTeams", () => {
  it("reads a page of the organization's teams", async () => {
    const cursor = "0:1:0";
    const { apiTarget, request } = scriptedTarget(
      jsonResponse(
        [{ slug: "a" }],
        nextLink("/organizations/acme/teams/", cursor),
      ),
    );

    const page = await listTeams(
      apiTarget,
      { organizationSlug: "acme", query: "a", limit: 1 },
      v.array(v.object({ slug: v.string() })),
    );

    expect(page).toEqual({ items: [{ slug: "a" }], nextCursor: cursor });
    const url = new URL(request.mock.calls[0]?.[0] ?? "");
    expect(url.pathname).toBe("/api/0/organizations/acme/teams/");
    expect(url.searchParams.get("per_page")).toBe("1");
    expect(url.searchParams.get("query")).toBe("a");
  });
});

describe("createTeam", () => {
  it("posts the name and validates the created team", async () => {
    const { apiTarget, request } = scriptedTarget(
      jsonResponse({ slug: "web" }),
    );

    const team = await createTeam(
      apiTarget,
      { organizationSlug: "acme", name: "web" },
      TeamZod,
    );

    expect(team).toEqual({ slug: "web" });
    const [url, init] = request.mock.calls[0] ?? [];
    expect(url).toBe(`${ORIGIN}/api/0/organizations/acme/teams/`);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ name: "web" }));
  });

  it("throws the shared validation error for a mismatched body", async () => {
    const { apiTarget } = scriptedTarget(jsonResponse({ slug: 1 }));

    await expect(
      createTeam(apiTarget, { organizationSlug: "acme", name: "web" }, TeamZod),
    ).rejects.toBeInstanceOf(ApiResponseValidationError);
  });
});
