import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  jsonResponse,
  nextLink,
  ORIGIN,
  scriptedTarget,
} from "../support.ts";
import { linkProjectRepository, listRepositories } from "../../../src/api-client/endpoints/repositories.ts";

describe("listRepositories", () => {
  it("follows every page with the query", async () => {
    const path = "/organizations/acme/repos/";
    const { apiTarget, request } = scriptedTarget(
      jsonResponse([{ name: "a" }], nextLink(path, "0:100:0")),
      jsonResponse([{ name: "b" }]),
    );

    const repos = await listRepositories(
      apiTarget,
      { organizationSlug: "acme", query: "sentry" },
      z.array(z.object({ name: z.string() })),
    );

    expect(repos).toEqual([{ name: "a" }, { name: "b" }]);
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      `${ORIGIN}/api/0${path}?per_page=100&query=sentry`,
      `${ORIGIN}/api/0${path}?per_page=100&query=sentry&cursor=0%3A100%3A0`,
    ]);
  });
});

describe("listRepositories cursors", () => {
  it("fails on a repeated cursor instead of looping", async () => {
    const path = "/organizations/acme/repos/";
    const { apiTarget, request } = scriptedTarget(
      jsonResponse([{ name: "a" }], nextLink(path, "0:100:0")),
      jsonResponse([{ name: "b" }], nextLink(path, "0:100:0")),
    );

    await expect(
      listRepositories(
        apiTarget,
        { organizationSlug: "acme" },
        z.array(z.object({ name: z.string() })),
      ),
    ).rejects.toThrow("API returned a repeated pagination cursor");
    expect(request).toHaveBeenCalledTimes(2);
  });
});

describe("linkProjectRepository", () => {
  it("posts one root code mapping for the project", async () => {
    const { apiTarget, request } = scriptedTarget(jsonResponse({ ok: true }));

    await linkProjectRepository(
      apiTarget,
      {
        organizationSlug: "acme",
        projectSlug: "web",
        repository: "acme/web",
        provider: "github",
      },
      z.object({ ok: z.boolean() }),
    );

    const [url, init] = request.mock.calls[0] ?? [];
    expect(url).toBe(`${ORIGIN}/api/0/organizations/acme/code-mappings/bulk/`);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(
      JSON.stringify({
        project: "web",
        repository: "acme/web",
        provider: "github",
        mappings: [{ stackRoot: "", sourceRoot: "" }],
      }),
    );
  });
});
