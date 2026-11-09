import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  jsonResponse,
  ORIGIN,
  scriptedTarget,
} from "../support.ts";
import {
  getEventCommitters,
  getRelease,
  listReleaseCommits,
  listReleaseDeploys,
  listReleases,
} from "../../../src/api-client/endpoints/releases.ts";

const AnyJson = z.unknown();
const API = `${ORIGIN}/api/0`;

/** The URL a wrapper call requested. */
async function requestedUrl(
  call: (target: ReturnType<typeof scriptedTarget>["apiTarget"]) => unknown,
) {
  const { apiTarget, request } = scriptedTarget(jsonResponse([]));
  await call(apiTarget);
  return request.mock.calls[0]?.[0];
}

describe("listReleases", () => {
  it.each([
    [{}, `${API}/organizations/acme/releases/`],
    [
      { projectSlug: "web", query: "1.0", limit: 5 },
      `${API}/projects/acme/web/releases/?query=1.0&per_page=5`,
    ],
  ])("sends %o to %s", async (params, url) => {
    expect(
      await requestedUrl((target) =>
        listReleases(target, { organizationSlug: "acme", ...params }, AnyJson),
      ),
    ).toBe(url);
  });
});

describe("getRelease", () => {
  it.each([
    [{}, `${API}/organizations/acme/releases/1.0%2Bbuild/`],
    [
      { projectSlugOrId: "web", includeHealth: true },
      `${API}/projects/acme/web/releases/1.0%2Bbuild/?health=1`,
    ],
  ])("sends %o to %s", async (params, url) => {
    expect(
      await requestedUrl((target) =>
        getRelease(
          target,
          { organizationSlug: "acme", releaseVersion: "1.0+build", ...params },
          AnyJson,
        ),
      ),
    ).toBe(url);
  });
});

describe("listReleaseDeploys", () => {
  it.each([
    ["42", "project=42"],
    ["web", "projectSlug=web"],
  ])("narrows project %s with %s", async (projectSlugOrId, query) => {
    expect(
      await requestedUrl((target) =>
        listReleaseDeploys(
          target,
          {
            organizationSlug: "acme",
            releaseVersion: "1.0",
            projectSlugOrId,
            limit: 3,
          },
          AnyJson,
        ),
      ),
    ).toBe(
      `${API}/organizations/acme/releases/1.0/deploys/?${query}&per_page=3`,
    );
  });
});

describe("listReleaseCommits", () => {
  it.each([
    [{}, `${API}/organizations/acme/releases/1.0/commits/`],
    [
      { projectSlugOrId: "web", limit: 2 },
      `${API}/projects/acme/web/releases/1.0/commits/?per_page=2`,
    ],
  ])("sends %o to %s", async (params, url) => {
    expect(
      await requestedUrl((target) =>
        listReleaseCommits(
          target,
          { organizationSlug: "acme", releaseVersion: "1.0", ...params },
          AnyJson,
        ),
      ),
    ).toBe(url);
  });
});

describe("getEventCommitters", () => {
  it("reads the event's committers", async () => {
    expect(
      await requestedUrl((target) =>
        getEventCommitters(
          target,
          { organizationSlug: "acme", projectSlug: "web", eventId: "abc" },
          AnyJson,
        ),
      ),
    ).toBe(`${API}/projects/acme/web/events/abc/committers/`);
  });
});
