import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  jsonResponse,
  ORIGIN,
  scriptedTarget,
} from "../support.ts";
import {
  createUptimeMonitor,
  deleteUptimeMonitor,
  listUptimeMonitorChecks,
  listUptimeMonitors,
  updateUptimeMonitor,
} from "../../../src/api-client/endpoints/uptime-monitors.ts";

const AnyJson = z.unknown();
const API = `${ORIGIN}/api/0`;
const monitor = {
  organizationSlug: "acme",
  projectSlug: "web",
  uptimeMonitorId: "42",
};

/** The URL and init of the request a wrapper call sent. */
async function sentRequest(
  call: (target: ReturnType<typeof scriptedTarget>["apiTarget"]) => unknown,
) {
  const { apiTarget, request } = scriptedTarget(jsonResponse({}));
  await call(apiTarget);
  const [url, init] = request.mock.calls[0] ?? [];
  return { url, init };
}

describe("listUptimeMonitors", () => {
  it("sends the filters", async () => {
    const { url } = await sentRequest((target) =>
      listUptimeMonitors(
        target,
        {
          organizationSlug: "acme",
          projectId: "7",
          environment: "prod",
          owner: "team:1",
          query: "api",
          limit: 5,
        },
        AnyJson,
      ),
    );

    expect(url).toBe(
      `${API}/organizations/acme/uptime/?project=7&environment=prod&owner=team%3A1&query=api&per_page=5`,
    );
  });

  it("sends no query string without filters", async () => {
    const { url } = await sentRequest((target) =>
      listUptimeMonitors(target, { organizationSlug: "acme" }, AnyJson),
    );

    expect(url).toBe(`${API}/organizations/acme/uptime/`);
  });
});

describe("listUptimeMonitorChecks", () => {
  it.each([
    [{}, "statsPeriod=24h"],
    [{ statsPeriod: " 7d ", limit: 3 }, "per_page=3&statsPeriod=7d"],
    [
      { start: "2026-01-01", end: "2026-01-02" },
      "start=2026-01-01&end=2026-01-02",
    ],
  ])("sends %o as %s", async (params, query) => {
    const { url } = await sentRequest((target) =>
      listUptimeMonitorChecks(target, { ...monitor, ...params }, AnyJson),
    );

    expect(url).toBe(`${API}/projects/acme/web/uptime/42/checks/?${query}`);
  });

  it("rejects a malformed period before sending", async () => {
    await expect(
      sentRequest((target) =>
        listUptimeMonitorChecks(
          target,
          { ...monitor, statsPeriod: "1y" },
          AnyJson,
        ),
      ),
    ).rejects.toThrow("statsPeriod");
  });
});

describe("createUptimeMonitor", () => {
  it("sends the required fields first and every set field, null included", async () => {
    const { url, init } = await sentRequest((target) =>
      createUptimeMonitor(
        target,
        {
          organizationSlug: "acme",
          projectSlug: "web",
          environment: null,
          method: "GET",
          name: "API",
          url: "https://example.com",
          intervalSeconds: 60,
          timeoutMs: 1000,
        },
        AnyJson,
      ),
    );

    expect(url).toBe(`${API}/projects/acme/web/uptime/`);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(
      JSON.stringify({
        name: "API",
        url: "https://example.com",
        intervalSeconds: 60,
        timeoutMs: 1000,
        method: "GET",
        environment: null,
      }),
    );
  });
});

describe("updateUptimeMonitor", () => {
  it("sends only the fields that are set", async () => {
    const { url, init } = await sentRequest((target) =>
      updateUptimeMonitor(
        target,
        { ...monitor, status: "disabled", owner: null },
        AnyJson,
      ),
    );

    expect(url).toBe(`${API}/projects/acme/web/uptime/42/`);
    expect(init?.method).toBe("PUT");
    expect(init?.body).toBe(
      JSON.stringify({ status: "disabled", owner: null }),
    );
  });
});

describe("deleteUptimeMonitor", () => {
  it("treats a 404 as already deleted", async () => {
    const { apiTarget, request } = scriptedTarget(
      new Response(null, { status: 404 }),
    );

    await deleteUptimeMonitor(apiTarget, monitor);

    expect(request.mock.calls[0]?.[0]).toBe(
      `${API}/projects/acme/web/uptime/42/`,
    );
    expect(request.mock.calls[0]?.[1]?.method).toBe("DELETE");
  });
});
