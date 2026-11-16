// Runs inside a clean project that installed the packed package, with no
// optional peers, on the runtime check.mjs was started with.
import assert from "node:assert/strict";
import { API_BASE_PATH, createSentryClient, SentryApiError } from "@sentry/api";
import { createBrowserFetch } from "@sentry/api/browser";
import { createApiTransport } from "@sentry/api/client";
import { listOrganizations } from "@sentry/api/client/endpoints";
import { operations } from "@sentry/api/docs";
import { operations as catalog } from "@sentry/api/operations";

assert.equal(API_BASE_PATH, "/api/0");
assert(catalog.some(operation => operation.functionName === "listOrganizations"));
assert(operations.some(operation => operation.path === "/organizations/"));
for (const value of [createBrowserFetch, createApiTransport, listOrganizations]) {
  assert.equal(typeof value, "function");
}

const requests = [];
const sentry = createSentryClient({
  baseUrl: "https://sentry.example.test/",
  headers: { Authorization: "Bearer token" },
  fetch: async request => {
    requests.push(request);
    return request.url.includes("/missing/")
      ? Response.json({ detail: "Not found" }, { status: 404 })
      : Response.json([{ slug: "acme" }], { headers: { "X-Hits": "1" } });
  },
});

// A typed operation against the mocked fetch.
const listed = await sentry.listOrganizations();
assert(!("error" in listed));
assert.deepEqual(listed.data, [{ slug: "acme" }]);
assert.equal(listed.request.url, "https://sentry.example.test/api/0/organizations/");
assert.equal(listed.request.headers.get("authorization"), "Bearer token");
assert.equal(listed.response.headers.get("x-hits"), "1");

// An HTTP error keeps its response.
const missing = await sentry.client.get({ url: "/missing/" });
assert("error" in missing);
assert(missing.error instanceof SentryApiError);
assert.equal(missing.error.status, 404);
assert.deepEqual(missing.error.body, { detail: "Not found" });

// An already-aborted signal stops the request before it reaches fetch.
const controller = new AbortController();
const reason = new Error("stop");
controller.abort(reason);
const sent = requests.length;
const cancelled = await sentry.listOrganizations({ signal: controller.signal });
assert("error" in cancelled);
assert.equal(cancelled.error, reason);
assert.equal(cancelled.response, undefined);
assert.equal(requests.length, sent);
