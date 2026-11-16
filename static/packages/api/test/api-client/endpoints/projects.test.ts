import { describe, expect, it } from "vitest";
import * as v from "valibot";
import { z } from "zod";
import {
  jsonResponse,
  nextLink,
  ORIGIN,
  scriptedTarget,
} from "../support.ts";
import {
  addProjectTeam,
  createProject,
  getProject,
  listProjects,
  listProjectTeams,
  removeProjectTeam,
  updateProject,
} from "../../../src/api-client/endpoints/projects.ts";

const ProjectZod = z.object({ slug: z.string() });

describe("listProjects", () => {
  it("reads a page of the organization's projects", async () => {
    const { apiTarget, request } = scriptedTarget(
      jsonResponse([{ slug: "web" }]),
    );

    const page = await listProjects(
      apiTarget,
      { organizationSlug: "acme", query: "we" },
      v.array(v.object({ slug: v.string() })),
    );

    expect(page).toEqual({ items: [{ slug: "web" }], nextCursor: null });
    const url = new URL(request.mock.calls[0]?.[0] ?? "");
    expect(url.pathname).toBe("/api/0/organizations/acme/projects/");
    expect(url.searchParams.get("per_page")).toBe("25");
    expect(url.searchParams.get("query")).toBe("we");
  });
});

describe("getProject", () => {
  it.each([
    [undefined, ""],
    ["organization" as const, "?collapse=organization"],
  ])("sends collapse=%s as %s", async (collapse, query) => {
    const { apiTarget, request } = scriptedTarget(
      jsonResponse({ slug: "web" }),
    );

    await getProject(
      apiTarget,
      { organizationSlug: "acme", projectSlugOrId: "web", collapse },
      ProjectZod,
    );

    expect(request.mock.calls[0]?.[0]).toBe(
      `${ORIGIN}/api/0/projects/acme/web/${query}`,
    );
  });
});

describe("createProject", () => {
  it.each([
    [{}, { name: "Web" }],
    [{ slug: "", platform: null }, { name: "Web" }],
    [
      { slug: "web", platform: "javascript" },
      { name: "Web", slug: "web", platform: "javascript" },
    ],
  ])("posts %o as %o to the team", async (optional, sent) => {
    const { apiTarget, request } = scriptedTarget(
      jsonResponse({ slug: "web" }),
    );

    await createProject(
      apiTarget,
      { organizationSlug: "acme", teamSlug: "core", name: "Web", ...optional },
      ProjectZod,
    );

    const [url, init] = request.mock.calls[0] ?? [];
    expect(url).toBe(`${ORIGIN}/api/0/teams/acme/core/projects/`);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify(sent));
  });
});

describe("updateProject", () => {
  it("puts only the non-empty fields", async () => {
    const { apiTarget, request } = scriptedTarget(
      jsonResponse({ slug: "app" }),
    );

    await updateProject(
      apiTarget,
      {
        organizationSlug: "acme",
        projectSlug: "web",
        name: "",
        slug: "app",
        platform: null,
      },
      ProjectZod,
    );

    const [url, init] = request.mock.calls[0] ?? [];
    expect(url).toBe(`${ORIGIN}/api/0/projects/acme/web/`);
    expect(init?.method).toBe("PUT");
    expect(init?.body).toBe(JSON.stringify({ slug: "app" }));
  });
});

describe("listProjectTeams", () => {
  it("follows every page", async () => {
    const path = "/projects/acme/web/teams/";
    const { apiTarget, request } = scriptedTarget(
      jsonResponse([{ slug: "a" }], nextLink(path, "0:100:0")),
      jsonResponse([{ slug: "b" }]),
    );

    const teams = await listProjectTeams(
      apiTarget,
      { organizationSlug: "acme", projectSlug: "web" },
      z.array(z.object({ slug: z.string() })),
    );

    expect(teams).toEqual([{ slug: "a" }, { slug: "b" }]);
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      `${ORIGIN}/api/0${path}?per_page=100`,
      `${ORIGIN}/api/0${path}?per_page=100&cursor=0%3A100%3A0`,
    ]);
  });
});

describe("listProjectTeams cursors", () => {
  it("fails on a repeated cursor instead of looping", async () => {
    const path = "/projects/acme/web/teams/";
    const { apiTarget, request } = scriptedTarget(
      jsonResponse([{ slug: "a" }], nextLink(path, "0:100:0")),
      jsonResponse([{ slug: "b" }], nextLink(path, "0:100:0")),
    );

    await expect(
      listProjectTeams(
        apiTarget,
        { organizationSlug: "acme", projectSlug: "web" },
        z.array(z.object({ slug: z.string() })),
      ),
    ).rejects.toThrow("API returned a repeated pagination cursor");
    expect(request).toHaveBeenCalledTimes(2);
  });
});

describe("project team assignment", () => {
  const params = {
    organizationSlug: "acme",
    projectSlug: "web",
    teamSlug: "core",
  };
  const url = `${ORIGIN}/api/0/projects/acme/web/teams/core/`;

  it("adds a team with an empty POST", async () => {
    const { apiTarget, request } = scriptedTarget(
      jsonResponse({ slug: "web" }),
    );

    await addProjectTeam(apiTarget, params);

    expect(request.mock.calls[0]?.[0]).toBe(url);
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: "{}",
    });
  });

  it("removes a team with a DELETE", async () => {
    const { apiTarget, request } = scriptedTarget(
      new Response(null, { status: 204 }),
    );

    await removeProjectTeam(apiTarget, params);

    expect(request.mock.calls[0]?.[0]).toBe(url);
    expect(request.mock.calls[0]?.[1]?.method).toBe("DELETE");
  });
});
