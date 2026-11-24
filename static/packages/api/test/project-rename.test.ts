import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createSentryClient, getSentryProjectRename, type SentryProjectRename } from "@sentry/api";

// Answers the way a project endpoint does for a project's old slug.
let server: Server;
let origin: string;

beforeAll(async () => {
  server = createServer((request, response) => {
    if (request.url?.startsWith("/api/0/projects/org-slug/old-slug/")) {
      const location = request.url.replace("/old-slug/", "/new-slug/");
      response.writeHead(302, { Location: location, "Content-Type": "application/json" });
      response.end(JSON.stringify({ slug: "new-slug", detail: { extra: { url: location, slug: "new-slug" } } }));
      return;
    }
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ slug: "new-slug" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("getSentryProjectRename", () => {
  test("reports a rename after fetch follows the redirect", async () => {
    const renames: SentryProjectRename[] = [];
    const sentry = createSentryClient({ baseUrl: origin });
    sentry.client.interceptors.response.use((response, request) => {
      const rename = getSentryProjectRename(request, response);
      if (rename) renames.push(rename);
      return response;
    });
    const { data } = await sentry.getProject({ path: { organization_id_or_slug: "org-slug", project_id_or_slug: "old-slug" } });
    expect(data).toEqual({ slug: "new-slug" });
    expect(renames).toEqual([
      { organization: "org-slug", previousSlug: "old-slug", slug: "new-slug", url: `${origin}/api/0/projects/org-slug/new-slug/` },
    ]);
  });

  test("reads the Location of an unfollowed redirect", async () => {
    const request = new Request(`${origin}/api/0/projects/org-slug/old-slug/keys/?cursor=0:0:0`, { redirect: "manual" });
    const response = await fetch(request);
    expect(response.status).toBe(302);
    expect(getSentryProjectRename(request, response)).toEqual({
      organization: "org-slug",
      previousSlug: "old-slug",
      slug: "new-slug",
      url: `${origin}/api/0/projects/org-slug/new-slug/keys/?cursor=0:0:0`,
    });
  });

  const requestUrl = "https://sentry.example.com/api/0/projects/org-slug/old-slug/";
  test.each([
    ["a response that was not redirected", new Response("{}")],
    ["a redirect to another origin", new Response(null, { status: 302, headers: { Location: "https://other.example.com/api/0/projects/org-slug/new-slug/" } })],
    ["a redirect that changes the organization", new Response(null, { status: 302, headers: { Location: "/api/0/projects/other-org/old-slug/" } })],
    ["a redirect that changes more than the slug", new Response(null, { status: 302, headers: { Location: "/api/0/projects/org-slug/new-slug/keys/" } })],
    ["a redirect that changes the query", new Response(null, { status: 302, headers: { Location: "/api/0/projects/org-slug/new-slug/?a=1" } })],
    ["a 302 without Location", new Response(null, { status: 302 })],
  ])("ignores %s", (_, response) => {
    expect(getSentryProjectRename(new Request(requestUrl), response)).toBeUndefined();
  });

  test("ignores redirects outside project paths", () => {
    const response = new Response(null, { status: 302, headers: { Location: "/api/0/organizations/new-slug/" } });
    expect(getSentryProjectRename(new Request("https://sentry.example.com/api/0/organizations/old-slug/"), response)).toBeUndefined();
  });
});
