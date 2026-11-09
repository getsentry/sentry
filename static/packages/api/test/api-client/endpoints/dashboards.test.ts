import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  jsonResponse,
  nextLink,
  ORIGIN,
  scriptedTarget,
} from "../support.ts";
import { getDashboard, listDashboards } from "../../../src/api-client/endpoints/dashboards.ts";

const DashboardZod = z.object({ id: z.string() });

describe("listDashboards", () => {
  it("reads one page with the filters and returns the next cursor", async () => {
    const path = "/organizations/acme/dashboards/";
    const { apiTarget, request } = scriptedTarget(
      jsonResponse([{ id: "1" }], nextLink(path, "0:10:0")),
    );

    const page = await listDashboards(
      apiTarget,
      {
        organizationSlug: "acme",
        query: "web",
        sortBy: "-dateCreated",
        cursor: "0:0:0",
      },
      z.array(DashboardZod),
    );

    expect(page).toEqual({ items: [{ id: "1" }], nextCursor: "0:10:0" });
    expect(request.mock.calls[0]?.[0]).toBe(
      `${ORIGIN}/api/0${path}?per_page=10&query=web&sort=-dateCreated&cursor=0%3A0%3A0`,
    );
  });
});

describe("getDashboard", () => {
  it("reads one dashboard", async () => {
    const { apiTarget, request } = scriptedTarget(jsonResponse({ id: "7" }));

    await getDashboard(
      apiTarget,
      { organizationSlug: "acme", dashboardId: "7" },
      DashboardZod,
    );

    expect(request.mock.calls[0]?.[0]).toBe(
      `${ORIGIN}/api/0/organizations/acme/dashboards/7/`,
    );
  });
});
