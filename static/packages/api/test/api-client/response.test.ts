import { describe, expect, it } from "vitest";
import { readErrorResponse, readJsonResponse } from "../../src/api-client/response.ts";

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

describe("readErrorResponse", () => {
  it("reads the server's detail message", async () => {
    const body = { detail: "Project not found", code: "missing" };
    const result = await readErrorResponse(jsonResponse(body, { status: 404 }));
    expect(result).toEqual({
      text: JSON.stringify(body),
      json: body,
      detail: "Project not found",
      isHtml: false,
      retryAfterMs: undefined,
    });
  });

  it("leaves detail unset when it is not a string", async () => {
    const result = await readErrorResponse(
      jsonResponse({ detail: { code: "x" } }, { status: 400 }),
    );
    expect(result.json).toEqual({ detail: { code: "x" } });
    expect(result.detail).toBeUndefined();
  });

  it("flags an HTML error page", async () => {
    const result = await readErrorResponse(
      new Response("<!DOCTYPE html><html>Bad gateway</html>", { status: 502 }),
    );
    expect(result.isHtml).toBe(true);
    expect(result.json).toBeUndefined();
    expect(result.parseError).toBeTypeOf("string");
  });

  it("keeps a plain-text body without flagging it as HTML", async () => {
    const result = await readErrorResponse(
      new Response("upstream timed out", { status: 504 }),
    );
    expect(result).toMatchObject({
      text: "upstream timed out",
      isHtml: false,
    });
    expect(result.parseError).toBeTypeOf("string");
  });

  it("reads the rate-limit wait from Retry-After", async () => {
    const result = await readErrorResponse(
      jsonResponse(
        { detail: "Slow down" },
        { status: 429, headers: { "retry-after": "3" } },
      ),
    );
    expect(result.retryAfterMs).toBe(3000);
  });

  it("returns no text when the body cannot be read", async () => {
    const response = new Response("ignored", { status: 500 });
    await response.text();
    expect(await readErrorResponse(response)).toEqual({
      text: undefined,
      isHtml: false,
      retryAfterMs: undefined,
    });
  });
});

describe("readJsonResponse", () => {
  it("parses a JSON body", async () => {
    expect(await readJsonResponse(jsonResponse({ id: 1 }))).toEqual({ id: 1 });
  });

  it("rejects an HTML body", async () => {
    await expect(
      readJsonResponse(
        new Response("<html></html>", {
          status: 200,
          statusText: "OK",
          headers: { "content-type": "text/html" },
        }),
      ),
    ).rejects.toThrow(
      "Expected JSON response but received HTML (200 OK). This may indicate you're not authenticated, the URL is incorrect, or there's a server issue.",
    );
  });

  it("rejects another content type", async () => {
    await expect(
      readJsonResponse(
        new Response("id,1", {
          status: 200,
          statusText: "OK",
          headers: { "content-type": "text/csv" },
        }),
      ),
    ).rejects.toThrow("Expected JSON response but received text/csv (200 OK)");
  });

  it("rejects malformed JSON", async () => {
    await expect(
      readJsonResponse(
        new Response("{", { headers: { "content-type": "application/json" } }),
      ),
    ).rejects.toThrow(/^Failed to parse JSON response: /);
  });
});
