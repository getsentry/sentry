import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  jsonResponse,
  nextLink,
  ORIGIN,
  scriptedTarget,
} from "../support.ts";
import {
  listIssueReplayIds,
  searchReplays,
  visitReplayRecordingSegments,
} from "../../../src/api-client/endpoints/replays.ts";

const AnyJson = z.unknown();
const API = `${ORIGIN}/api/0`;
const SegmentPage = z.array(z.array(z.unknown()));
const segments = {
  organizationSlug: "acme",
  projectSlugOrId: "web",
  replayId: "r1",
};
const segmentsPath = "/projects/acme/web/replays/r1/recording-segments/";

describe("searchReplays", () => {
  it("sends every filter, repeating environments and fields", async () => {
    const { apiTarget, request } = scriptedTarget(jsonResponse({ data: [] }));

    await searchReplays(
      apiTarget,
      {
        organizationSlug: "acme",
        query: "user.email:a@b.c",
        limit: 5,
        projectId: "7",
        sort: "-started_at",
        environment: ["prod", "staging"],
        fields: ["id", "duration"],
        statsPeriod: "7d",
      },
      AnyJson,
    );

    expect(request.mock.calls[0]?.[0]).toBe(
      `${API}/organizations/acme/replays/?query=user.email%3Aa%40b.c&per_page=5&project=7&sort=-started_at&environment=prod&environment=staging&field=id&field=duration&statsPeriod=7d`,
    );
  });
});

describe("listIssueReplayIds", () => {
  it("asks for the issue's replay IDs over 90 days in all projects", async () => {
    const { apiTarget, request } = scriptedTarget(jsonResponse({}));

    await listIssueReplayIds(
      apiTarget,
      { organizationSlug: "acme", issueId: 42, dataSource: "discover" },
      AnyJson,
    );

    expect(request.mock.calls[0]?.[0]).toBe(
      `${API}/organizations/acme/replay-count/?returnIds=true&query=issue.id%3A%5B42%5D&data_source=discover&statsPeriod=90d&project=-1`,
    );
  });
});

describe("visitReplayRecordingSegments", () => {
  it("follows the cursor and visits each segment", async () => {
    const { apiTarget, request } = scriptedTarget(
      jsonResponse([["a"], ["b"]], nextLink(segmentsPath, "0:100:0")),
      jsonResponse([["c"]]),
    );
    const onSegment = vi.fn();

    const result = await visitReplayRecordingSegments(
      apiTarget,
      { ...segments, maxSegments: 10 },
      SegmentPage,
      onSegment,
    );

    expect(result).toEqual({ segmentsRead: 3, truncated: false });
    expect(onSegment.mock.calls).toEqual([[["a"]], [["b"]], [["c"]]]);
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      `${API}${segmentsPath}?per_page=100`,
      `${API}${segmentsPath}?per_page=100&cursor=0%3A100%3A0`,
    ]);
  });

  it("stops at the segment limit and reports truncation", async () => {
    const { apiTarget, request } = scriptedTarget(
      jsonResponse([["a"], ["b"]], nextLink(segmentsPath, "0:100:0")),
    );
    const onSegment = vi.fn();

    const result = await visitReplayRecordingSegments(
      apiTarget,
      { ...segments, maxSegments: 2 },
      SegmentPage,
      onSegment,
    );

    expect(result).toEqual({ segmentsRead: 2, truncated: true });
    expect(onSegment).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("stops at an empty page that still has a cursor", async () => {
    const { apiTarget, request } = scriptedTarget(
      jsonResponse([], nextLink(segmentsPath, "0:100:0")),
      jsonResponse([], nextLink(segmentsPath, "0:200:0")),
    );

    const result = await visitReplayRecordingSegments(
      apiTarget,
      { ...segments, maxSegments: 10 },
      SegmentPage,
      vi.fn(),
    );

    expect(result).toEqual({ segmentsRead: 0, truncated: true });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
