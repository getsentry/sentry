import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  jsonResponse,
  ORIGIN,
  scriptedTarget,
} from "../support.ts";
import {
  deleteMonitorEnvironment,
  getMonitor,
  getMonitorStats,
  listMonitorCheckIns,
  listMonitors,
} from "../../../src/api-client/endpoints/monitors.ts";

const AnyJson = z.unknown();
const API = `${ORIGIN}/api/0`;
const monitor = { organizationSlug: "acme", monitorSlug: "nightly" };

/** The URL a wrapper call requested. */
async function requestedUrl(
  call: (target: ReturnType<typeof scriptedTarget>["apiTarget"]) => unknown,
) {
  const { apiTarget, request } = scriptedTarget(jsonResponse([]));
  await call(apiTarget);
  return request.mock.calls[0]?.[0];
}

describe("listMonitors", () => {
  it("sends the filters", async () => {
    expect(
      await requestedUrl((target) =>
        listMonitors(
          target,
          {
            organizationSlug: "acme",
            projectSlug: "web",
            environment: "prod",
            owner: "team:1",
            query: "job",
            limit: 5,
          },
          AnyJson,
        ),
      ),
    ).toBe(
      `${API}/organizations/acme/monitors/?projectSlug=web&environment=prod&owner=team%3A1&query=job&per_page=5`,
    );
  });
});

describe("getMonitor", () => {
  it.each([
    [{}, `${API}/organizations/acme/monitors/nightly/`],
    [
      { projectSlug: "web", environment: "prod" },
      `${API}/projects/acme/web/monitors/nightly/?environment=prod`,
    ],
  ])("sends %o to %s", async (params, url) => {
    expect(
      await requestedUrl((target) =>
        getMonitor(target, { ...monitor, ...params }, AnyJson),
      ),
    ).toBe(url);
  });
});

describe("deleteMonitorEnvironment", () => {
  it("treats a 404 as already deleted", async () => {
    const { apiTarget, request } = scriptedTarget(
      new Response(null, { status: 404 }),
    );

    await deleteMonitorEnvironment(apiTarget, {
      ...monitor,
      projectSlug: "web",
      environment: "prod",
    });

    expect(request.mock.calls[0]?.[0]).toBe(
      `${API}/projects/acme/web/monitors/nightly/environments/prod/`,
    );
    expect(request.mock.calls[0]?.[1]?.method).toBe("DELETE");
  });
});

describe("listMonitorCheckIns", () => {
  it.each([
    [{}, "statsPeriod=24h"],
    [{ statsPeriod: " 7d ", limit: 3 }, "per_page=3&statsPeriod=7d"],
    [
      { start: "2026-01-01", end: "2026-01-02" },
      "start=2026-01-01&end=2026-01-02",
    ],
  ])("sends %o as %s", async (params, query) => {
    expect(
      await requestedUrl((target) =>
        listMonitorCheckIns(target, { ...monitor, ...params }, AnyJson),
      ),
    ).toBe(`${API}/organizations/acme/monitors/nightly/checkins/?${query}`);
  });

  it("rejects a malformed period before sending", async () => {
    await expect(
      requestedUrl((target) =>
        listMonitorCheckIns(target, { ...monitor, statsPeriod: "1y" }, AnyJson),
      ),
    ).rejects.toThrow("statsPeriod");
  });
});

describe("getMonitorStats", () => {
  it("sends the range as since and until seconds", async () => {
    const url = await requestedUrl((target) =>
      getMonitorStats(
        target,
        {
          ...monitor,
          projectSlug: "web",
          environment: "prod",
          start: "1970-01-01T00:00:10Z",
          end: "1970-01-01T00:00:20Z",
          rollup: 60,
        },
        AnyJson,
      ),
    );

    expect(url).toBe(
      `${API}/projects/acme/web/monitors/nightly/stats/?environment=prod&since=10&until=20&resolution=60s`,
    );
  });
});
