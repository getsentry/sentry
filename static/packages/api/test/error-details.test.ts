import { describe, expect, test } from "vitest";
import { createSentryClient, getSentryApiErrorDetails, SentryApiError, type SentryApiErrorDetails } from "../src/index";

const request = new Request("https://sentry.example.com/api/0/organizations/acme/?cursor=abc", { method: "PUT" });

const errorFor = (body: unknown, rawBody: string | undefined, status: number | undefined = 400) =>
  new SentryApiError(status, body, new Response(rawBody, { status: status ?? 200, statusText: "Bad Request" }), false, undefined, {
    request,
    rawBody,
  });

describe("getSentryApiErrorDetails", () => {
  test("collects the request and a JSON response", () => {
    const body = { detail: "Invalid slug" };
    expect(getSentryApiErrorDetails(errorFor(body, JSON.stringify(body)))).toEqual({
      method: "PUT",
      path: "/api/0/organizations/acme/",
      status: 400,
      statusText: "Bad Request",
      responseJSON: body,
      responseText: '{"detail":"Invalid slug"}',
      summary: "PUT /api/0/organizations/acme/ 400",
    });
  });

  test("leaves responseJSON out when the body was not JSON", () => {
    const details = getSentryApiErrorDetails(errorFor("<html>Bad gateway</html>", "<html>Bad gateway</html>", 502));
    expect(details).not.toHaveProperty("responseJSON");
    expect(details.responseText).toBe("<html>Bad gateway</html>");
  });

  test("keeps a JSON string body", () => {
    expect(getSentryApiErrorDetails(errorFor("Invalid", '"Invalid"')).responseJSON).toBe("Invalid");
  });

  test("uses the request it is given, and GET without one", () => {
    const error = new SentryApiError(404, { detail: "Not found" }, undefined, false);
    expect(getSentryApiErrorDetails(error)).toEqual({ method: "GET", status: 404, responseJSON: { detail: "Not found" }, summary: "GET 404" });
    expect(getSentryApiErrorDetails(error, new Request("https://sentry.example.com/api/0/projects/", { method: "POST" })).summary)
      .toBe("POST /api/0/projects/ 404");
  });

  test("writes n/a for a missing status", () => {
    expect(getSentryApiErrorDetails(new SentryApiError(undefined, undefined, undefined, false, undefined, { request })).summary)
      .toBe("PUT /api/0/organizations/acme/ n/a");
  });

  test("lets an error interceptor map HTTP failures to an application's error class", async () => {
    class RequestError extends Error {
      constructor(readonly details: SentryApiErrorDetails, options?: ErrorOptions) {
        super(details.summary, options);
      }
    }
    const sentry = createSentryClient({
      baseUrl: "https://sentry.example.com",
      fetch: async () => Response.json({ detail: "The requested resource does not exist" }, { status: 404 }),
    });
    sentry.client.interceptors.error.use((error, _response, request) =>
      error instanceof SentryApiError ? new RequestError(getSentryApiErrorDetails(error, request), { cause: error }) : error,
    );

    const result = await sentry.listOrganizations();
    expect(result.error).toBeInstanceOf(RequestError);
    const error = result.error as RequestError;
    expect(error.message).toBe("GET /api/0/organizations/ 404");
    expect(error.details.responseJSON).toEqual({ detail: "The requested resource does not exist" });
    expect(error.cause).toBeInstanceOf(SentryApiError);
  });
});
