import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  type ApiRequestTransport,
  createApiClientCore,
  listPage,
} from "../../src/api-client/core.ts";
import {
  ApiNotFoundError,
  ApiPermissionError,
  ApiRateLimitError,
  ApiServerError,
  ApiValidationError,
  ConfigurationError,
} from "../../src/api-client/errors.ts";
import { ApiResponseValidationError } from "../../src/api-client/validate.ts";

const ORIGIN = "https://us.sentry.io";

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

/** A core over a transport that answers every request with `respond`. */
function setup(respond: ApiRequestTransport["request"]) {
  const transport = { request: vi.fn(respond) };
  const logger = { warn: vi.fn() };
  const core = createApiClientCore({
    transport,
    headers: () => ({ Authorization: "Bearer token", "User-Agent": "test" }),
    logger,
  });
  return { core, transport, logger };
}

describe("createApiClientCore request", () => {
  it("sends the host's headers to the API URL, replacing the caller's", async () => {
    const { core, transport } = setup(async () => jsonResponse({}));
    const signal = new AbortController().signal;

    await core.request(ORIGIN, "/organizations/acme/", {
      method: "PUT",
      body: "{}",
      signal,
      headers: { "X-Dropped": "1" },
    });

    expect(transport.request).toHaveBeenCalledWith(
      "https://us.sentry.io/api/0/organizations/acme/",
      {
        method: "PUT",
        body: "{}",
        signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
          "User-Agent": "test",
        },
      },
    );
  });

  it("throws the host's header error before sending", async () => {
    const transport = { request: vi.fn() };
    const core = createApiClientCore({
      transport,
      headers: () => {
        throw new ConfigurationError("Malformed authentication token");
      },
      logger: { warn: vi.fn() },
    });

    await expect(core.request(ORIGIN, "/")).rejects.toThrow(
      "Malformed authentication token",
    );
    expect(transport.request).not.toHaveBeenCalled();
  });

  it("throws the status's ApiError with the server's detail", async () => {
    const { core, logger } = setup(async () =>
      jsonResponse({ detail: "Project not found" }, { status: 404 }),
    );

    const error = await core
      .request(ORIGIN, "/projects/acme/x/")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiNotFoundError);
    expect(error).toMatchObject({
      message: "Project not found",
      status: 404,
      detail: "Project not found",
      responseBody: { detail: "Project not found" },
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("returns an allowed error status instead of throwing", async () => {
    const { core } = setup(async () =>
      jsonResponse({ detail: "Gone" }, { status: 404 }),
    );

    const response = await core.request(ORIGIN, "/x/", undefined, {
      allowStatuses: [404],
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ detail: "Gone" });
  });

  it("carries a rate limit's wait on the error", async () => {
    const { core } = setup(async () =>
      jsonResponse(
        { detail: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": "3" } },
      ),
    );

    const error = await core.request(ORIGIN, "/x/").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiRateLimitError);
    expect(error).toMatchObject({ retryAfterMs: 3000 });
  });

  it("carries an insufficient_scope 403's accepted scopes on the error", async () => {
    const { core } = setup(async () =>
      jsonResponse(
        { detail: "You do not have permission to perform this action." },
        {
          status: 403,
          headers: {
            "WWW-Authenticate":
              'Bearer error="insufficient_scope", scope="event:write event:admin seer:write"',
          },
        },
      ),
    );

    const error = await core.request(ORIGIN, "/x/").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiPermissionError);
    expect(error).toMatchObject({
      acceptedScopes: ["event:write", "event:admin", "seer:write"],
    });
  });

  it("reports an HTML error page as a server error and logs it", async () => {
    const { core, logger } = setup(
      async () =>
        new Response("<!DOCTYPE html><html>Bad gateway</html>", {
          status: 502,
          statusText: "Bad Gateway",
        }),
    );

    const error = await core.request(ORIGIN, "/x/").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiServerError);
    expect((error as Error).message).toBe(
      "Server error: Received HTML instead of JSON (502 Bad Gateway). This may indicate an invalid URL or server issue.",
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Received HTML error page instead of JSON",
      expect.objectContaining({
        status: 502,
        host: "us.sentry.io",
        path: "/x/",
      }),
    );
  });

  it("falls back to the status text and body for an unreadable error", async () => {
    const { core, logger } = setup(
      async () =>
        new Response("upstream timed out", {
          status: 503,
          statusText: "Service Unavailable",
        }),
    );

    const error = await core.request(ORIGIN, "/x/").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiServerError);
    expect((error as Error).message).toBe(
      "API request failed: Service Unavailable\nupstream timed out",
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Failed to parse JSON error response",
      expect.objectContaining({ bodyPreview: "upstream timed out" }),
    );
  });

  it("logs a JSON error body with no string detail", async () => {
    const { core, logger } = setup(async () =>
      jsonResponse({ detail: { code: "x" } }, { status: 400 }),
    );

    await expect(core.request(ORIGIN, "/x/")).rejects.toThrow(
      "API request failed",
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Failed to parse validated API error response",
      expect.objectContaining({
        validationErrorMessage: "Error response has no string detail",
      }),
    );
  });

  it("reports an unreachable host as a configuration error", async () => {
    const { core } = setup(async () => {
      throw new TypeError("fetch failed", {
        cause: new Error("getaddrinfo ENOTFOUND us.sentry.io"),
      });
    });

    const error = await core.request(ORIGIN, "/x/").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConfigurationError);
    expect((error as Error).message).toBe(
      "Unable to connect to https://us.sentry.io/api/0/x/ - Hostname not found. Verify the URL is correct.",
    );
  });

  it("names the URL for other network failures", async () => {
    const { core } = setup(async () => {
      throw new TypeError("fetch failed", {
        cause: new Error("read ECONNRESET"),
      });
    });

    const error = await core.request(ORIGIN, "/x/").catch((e: unknown) => e);

    expect(error).not.toBeInstanceOf(ConfigurationError);
    expect((error as Error).message).toBe(
      "Unable to connect to https://us.sentry.io/api/0/x/ - Connection reset. Try again in a moment.",
    );
  });

  it("rethrows the caller's abort unchanged", async () => {
    const controller = new AbortController();
    const reason = new DOMException("stopped", "AbortError");
    const { core } = setup(async () => {
      controller.abort(reason);
      throw reason;
    });

    await expect(
      core.request(ORIGIN, "/x/", { signal: controller.signal }),
    ).rejects.toBe(reason);
  });
});

describe("createApiClientCore requestJson", () => {
  it("returns the parsed body", async () => {
    const { core } = setup(async () => jsonResponse([{ slug: "acme" }]));

    expect(await core.requestJson(ORIGIN, "/organizations/")).toEqual([
      { slug: "acme" },
    ]);
  });

  it("rejects a successful response that is not JSON", async () => {
    const { core } = setup(
      async () =>
        new Response("<html></html>", {
          headers: { "content-type": "text/html" },
        }),
    );

    await expect(core.requestJson(ORIGIN, "/organizations/")).rejects.toThrow(
      "Expected JSON response but received HTML",
    );
  });
});

describe("listPage", () => {
  const rows = z.array(z.object({ id: z.number() }));

  function page(ids: number[], nextCursor?: string) {
    const headers: Record<string, string> = nextCursor
      ? {
          link: `<${ORIGIN}/api/0/x/?cursor=${nextCursor}>; rel="next"; results="true"; cursor="${nextCursor}"`,
        }
      : {};
    return {
      data: ids.map((id) => ({ id })),
      response: new Response(null, { headers }),
    };
  }

  it.each([0, 1.5, 5001])("rejects limit %s", async (limit) => {
    await expect(
      listPage(async () => page([]), rows, limit),
    ).rejects.toBeInstanceOf(ApiValidationError);
  });

  it("rejects a page with more rows than requested", async () => {
    await expect(
      listPage(async () => page([1, 2, 3]), rows, 2),
    ).rejects.toThrow("API returned more items than requested");
  });

  it("rejects a repeated cursor", async () => {
    await expect(
      listPage(async () => page([1], "0:1:0"), rows, 5),
    ).rejects.toThrow("API returned a repeated pagination cursor");
  });

  /**
   * Sentry's `OffsetPaginator` (`src/sentry/api/paginator.py`) over `total`
   * rows. Its cursor is `<page size>:<page>:<is_prev>`; a request whose
   * `per_page` differs from the cursor's page size reads the cursor's window
   * and keeps only its last `per_page` rows.
   */
  function offsetPaginator(total: number) {
    const requests: Array<{ perPage: number; cursor: string | undefined }> =
      [];
    async function fetchPage(perPage: number, cursor: string | undefined) {
      requests.push({ perPage, cursor });
      const [value = 0, pageIndex = 0] = (cursor ?? "0:0:0")
        .split(":")
        .map(Number);
      const start = pageIndex * value;
      const stop = Math.min(total, start + (value || perPage) + 1);
      let window = ids(start, stop);
      if (value !== perPage) {
        window = window.slice(-(perPage + 1));
      }
      return page(
        window.slice(0, perPage),
        window.length > perPage ? `${perPage}:${pageIndex + 1}:0` : undefined,
      );
    }
    return { fetchPage, requests };
  }

  function ids(start: number, stop: number) {
    return Array.from({ length: stop - start }, (_, index) => start + index);
  }

  function idsOf(result: { items: Array<{ id: number }> }) {
    return result.items.map(({ id }) => id);
  }

  it("keeps per_page stable across an OffsetPaginator walk", async () => {
    const { fetchPage, requests } = offsetPaginator(300);

    const first = await listPage(fetchPage, rows, 150);
    const second = await listPage(fetchPage, rows, 150, first.nextCursor);

    expect(idsOf(first)).toEqual(ids(0, 150));
    expect(idsOf(second)).toEqual(ids(150, 300));
    expect(second.nextCursor).toBeNull();
    expect(new Set(requests.map(({ perPage }) => perPage))).toEqual(
      new Set([75]),
    );
  });

  it("resumes an OffsetPaginator cursor with the page size it encodes", async () => {
    const { fetchPage, requests } = offsetPaginator(300);
    // Pairing `100:1:0` with per_page=50 reads rows 150-199 and skips 100-149.
    expect((await fetchPage(50, "100:1:0")).data).toEqual(
      ids(150, 200).map((id) => ({ id })),
    );
    requests.length = 0;

    const first = await listPage(fetchPage, rows, 50, "100:1:0");
    const second = await listPage(fetchPage, rows, 50, first.nextCursor);

    expect(idsOf(first)).toEqual(ids(100, 150));
    expect(idsOf(second)).toEqual(ids(150, 200));
    expect(requests.map(({ perPage }) => perPage)).toEqual([100, 100]);
  });

  it("validates each page with the schema", async () => {
    await expect(
      listPage(
        async () => ({ data: [{ id: "x" }], response: new Response(null) }),
        rows,
        5,
      ),
    ).rejects.toBeInstanceOf(ApiResponseValidationError);
  });
});

describe("createApiClientCore sdkClient", () => {
  it("rejects an SDK request to another path", async () => {
    const { core, transport } = setup(async () => jsonResponse([]));
    const client = core.sdkClient(ORIGIN, "/organizations/");

    await expect(
      client.get({ url: "/projects/", throwOnError: true }),
    ).rejects.toThrow("Unexpected SDK request target or method");
    expect(transport.request).not.toHaveBeenCalled();
  });
});
