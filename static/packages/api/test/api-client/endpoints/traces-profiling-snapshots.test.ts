import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  jsonResponse,
  ORIGIN,
  scriptedTarget,
} from "../support.ts";
import {
  getFlamegraph,
  getProfileChunks,
  getTransactionProfile,
} from "../../../src/api-client/endpoints/profiling.ts";
import {
  getLatestBaseSnapshot,
  getSnapshot,
  getSnapshotImage,
} from "../../../src/api-client/endpoints/snapshots.ts";
import { getTrace, getTraceMeta } from "../../../src/api-client/endpoints/traces.ts";

const AnyJson = z.unknown();
const API = `${ORIGIN}/api/0`;
const trace = { organizationSlug: "acme", traceId: "abc123" };

/** The URL a wrapper call requested. */
async function requestedUrl(
  call: (target: ReturnType<typeof scriptedTarget>["apiTarget"]) => unknown,
) {
  const { apiTarget, request } = scriptedTarget(jsonResponse({}));
  await call(apiTarget);
  return request.mock.calls[0]?.[0];
}

describe("traces", () => {
  it("sends the default period for trace meta", async () => {
    expect(
      await requestedUrl((target) => getTraceMeta(target, trace, AnyJson)),
    ).toBe(`${API}/organizations/acme/trace-meta/abc123/?statsPeriod=14d`);
  });

  it("sends the declared trace parameters with their defaults", async () => {
    expect(
      await requestedUrl((target) =>
        getTrace(target, { ...trace, statsPeriod: "7d" }, AnyJson),
      ),
    ).toBe(
      `${API}/organizations/acme/trace/abc123/?limit=1000&project=-1&statsPeriod=7d`,
    );
  });
});

describe("profiling", () => {
  it("escapes the transaction name in the flamegraph query", async () => {
    const url = await requestedUrl((target) =>
      getFlamegraph(
        target,
        {
          organizationSlug: "acme",
          projectId: 7,
          transactionName: 'GET /a\\b "c"',
        },
        AnyJson,
      ),
    );

    const query = new URL(url ?? "").searchParams;
    expect(query.get("project")).toBe("7");
    expect(query.get("query")).toBe(
      'event.type:transaction transaction:"GET /a\\\\b \\"c\\""',
    );
    expect(query.get("statsPeriod")).toBe("7d");
  });

  it("requests a transaction profile by project", async () => {
    expect(
      await requestedUrl((target) =>
        getTransactionProfile(
          target,
          { organizationSlug: "acme", projectSlugOrId: "web", profileId: "p1" },
          AnyJson,
        ),
      ),
    ).toBe(`${API}/projects/acme/web/profiling/profiles/p1/`);
  });

  it("sends the profiler and range for chunks", async () => {
    expect(
      await requestedUrl((target) =>
        getProfileChunks(
          target,
          {
            organizationSlug: "acme",
            profilerId: "prof",
            projectId: 7,
            start: "2026-01-01T00:00:00Z",
            end: "2026-01-01T01:00:00Z",
          },
          AnyJson,
        ),
      ),
    ).toBe(
      `${API}/organizations/acme/profiling/chunks/?profiler_id=prof&project=7&start=2026-01-01T00%3A00%3A00Z&end=2026-01-01T01%3A00%3A00Z`,
    );
  });
});

describe("snapshots", () => {
  const snapshots = `${API}/organizations/acme/preprodartifacts/snapshots`;

  it.each([
    [{}, `${snapshots}/s1/?compact_metadata=true`],
    [{ compactMetadata: false }, `${snapshots}/s1/`],
  ])("requests a snapshot with %o", async (params, url) => {
    expect(
      await requestedUrl((target) =>
        getSnapshot(target, {
          organizationSlug: "acme",
          snapshotId: "s1",
          ...params,
        }),
      ),
    ).toBe(url);
  });

  it("requests one snapshot image", async () => {
    expect(
      await requestedUrl((target) =>
        getSnapshotImage(target, {
          organizationSlug: "acme",
          snapshotId: "s1",
          imageIdentifier: "home.png",
        }),
      ),
    ).toBe(`${snapshots}/s1/images/home.png/`);
  });

  it("sends the set filters for the latest base snapshot", async () => {
    expect(
      await requestedUrl((target) =>
        getLatestBaseSnapshot(target, {
          organizationSlug: "acme",
          appId: "com.example",
          branch: "main",
          projectSlug: "ios",
        }),
      ),
    ).toBe(
      `${snapshots}/latest-base/?app_id=com.example&branch=main&projectSlug=ios&compact_metadata=true`,
    );
  });
});
