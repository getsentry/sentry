import { describe, expect, test } from "vitest";
import {
  createSentryClient,
  listOrganizations,
  narrowError_getProject,
  SentryApiError,
  type Config,
} from "@sentry/api";

const asFetch = (implementation: (request: Request) => Promise<Response>) =>
  ((input: RequestInfo | URL, init?: RequestInit) =>
    implementation(input instanceof Request && init === undefined ? input : new Request(input, init))) as NonNullable<Config["fetch"]>;

describe("public fields contract", () => {
  test("rejects data-only configuration before dispatch without poisoning existing configuration", async () => {
    let requests = 0;
    const fetch = asFetch(async request => {
      requests++;
      expect(request.headers.get("X-Context")).toBe("original");
      return Response.json([]);
    });
    // Exercise callers outside TypeScript as well as the separate type tests.
    const dataOnly = { responseStyle: "data" } as unknown as Pick<Config, "responseStyle">;
    expect(() => createSentryClient({ ...dataOnly, fetch })).toThrow();

    const sentry = createSentryClient({
      baseUrl: "https://example.test", headers: { "X-Context": "original" }, fetch,
    });
    expect(() => sentry.client.setConfig({
      ...dataOnly, headers: { "X-Context": "invalid" },
    })).toThrow();
    await expect(sentry.listOrganizations(dataOnly)).rejects.toThrow();
    await expect(listOrganizations({ ...dataOnly, client: sentry.client })).rejects.toThrow();
    expect(requests).toBe(0);

    const result = await listOrganizations({ client: sentry.client, responseStyle: "fields" });
    expect(result.data).toEqual([]);
    expect("error" in result).toBe(false);
    expect(requests).toBe(1);
  });

  test("retains native request, response and headers on a successful throwing operation", async () => {
    let sent: Request | undefined;
    const response = Response.json([], { status: 201, headers: { "X-Hits": "0" } });
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(async request => { sent = request; return response; }),
    });
    const result = await sentry.listOrganizations({ throwOnError: true });

    expect(result.data).toEqual([]);
    expect("error" in result).toBe(false);
    expect(result.request).toBe(sent!);
    expect(result.response).toBe(response);
    expect(result.response.status).toBe(201);
    expect(result.response.headers.get("X-Hits")).toBe("0");
  });

  test("preserves exact HTTP error text and parsed bodies without cloning or reading twice", async () => {
    class ObservedResponse extends Response {
      reads = 0;
      clones = 0;
      override text() { this.reads++; return super.text(); }
      override clone() { this.clones++; return super.clone(); }
    }

    for (const [rawBody, body] of [
      ['{ "detail": "Unavailable" }\n', { detail: "Unavailable" }],
      ["null", null],
      ["false", false],
      ["0", 0],
      ['""', ""],
      ["", ""],
      ["<html>Unavailable</html>\n", "<html>Unavailable</html>\n"],
      ['{"detail":', '{"detail":'],
    ] as const) {
      const response = new ObservedResponse(rawBody, {
        status: 502, headers: { "Retry-After": "3" },
      });
      const sentry = createSentryClient({
        baseUrl: "https://example.test", fetch: asFetch(async () => response),
      });
      const result = await sentry.listOrganizations();
      expect(result.error).toBeInstanceOf(SentryApiError);
      if (!(result.error instanceof SentryApiError)) throw result.error;

      expect(result.error.status).toBe(502);
      expect(result.error.body).toEqual(body);
      expect(result.error.rawBody).toBe(rawBody);
      expect(result.error.documented).toBe(false);
      expect(result.error.request).toBe(result.request);
      expect(result.error.response).toBe(response);
      expect(result.response).toBe(response);
      expect(result.error.response?.headers.get("Retry-After")).toBe("3");
      expect(response.reads).toBe(1);
      expect(response.clones).toBe(0);
    }
  });

  test("normalizes HTTP errors before interceptors and preserves the mapped error through operations and pagination", async () => {
    const seen: unknown[] = [];
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(async () => new Response('{ "detail": "Forbidden" }\n', { status: 403 })),
    });
    const mapped = new Error("Frontend RequestError equivalent");
    sentry.client.interceptors.error.use((error, response, request) => {
      expect(error).toBeInstanceOf(SentryApiError);
      if (!(error instanceof SentryApiError)) throw error;
      expect(error.body).toEqual({ detail: "Forbidden" });
      expect(error.rawBody).toBe('{ "detail": "Forbidden" }\n');
      expect(error.response).toBe(response);
      expect(error.request).toBe(request);
      return mapped;
    });
    sentry.client.interceptors.error.use(error => {
      seen.push(error);
      return error;
    });

    const result = await sentry.listOrganizations();
    expect(result.error).toBe(mapped);
    for (const call of [
      () => listOrganizations({ client: sentry.client, throwOnError: true }),
      () => sentry.fetchPage.listOrganizations({}),
      () => sentry.paginateAll.listOrganizations({}),
      () => sentry.paginateUpTo.listOrganizations({}, { limit: 1 }),
    ]) {
      await expect(call()).rejects.toBe(mapped);
    }
    expect(seen).toHaveLength(5);
    expect(seen.every(error => error === mapped)).toBe(true);
  });

  test("preserves values returned or thrown by an error interceptor", async () => {
    for (const mapped of [undefined, null, false, 0, ""]) {
      const sentry = createSentryClient({
        baseUrl: "https://example.test",
        fetch: asFetch(async () => Response.json({}, { status: 403 })),
      });
      sentry.client.interceptors.error.use(() => mapped);
      const result = await sentry.listOrganizations();
      expect("error" in result).toBe(true);
      expect(result.error).toBe(mapped);
      await expect(sentry.fetchPage.listOrganizations({})).rejects.toBe(mapped);
    }

    const thrown = new Error("Error mapper failed");
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(async () => Response.json({}, { status: 403 })),
    });
    sentry.client.interceptors.error.use(() => { throw thrown; });
    await expect(sentry.listOrganizations()).rejects.toBe(thrown);
  });

  test("typed HTTP narrowing preserves custom SentryApiError subclasses", async () => {
    class ApplicationError extends SentryApiError {
      readonly code = "application-permission";
    }
    const response = Response.json({}, { status: 403 });
    const custom = new ApplicationError(403, {}, response, false);
    const sentry = createSentryClient({
      baseUrl: "https://example.test", fetch: asFetch(async () => response),
    });
    sentry.client.interceptors.error.use(() => custom);
    await expect(narrowError_getProject({
      client: sentry.client,
      path: { organization_id_or_slug: "example", project_id_or_slug: "example" },
    })).rejects.toBe(custom);

    // A custom fetch can throw an SDK error from a different, nested request.
    const nested = new SentryApiError(503, {}, response, false);
    const outer = createSentryClient({
      baseUrl: "https://example.test", fetch: asFetch(async () => { throw nested; }),
    });
    await expect(narrowError_getProject({
      client: outer.client,
      path: { organization_id_or_slug: "example", project_id_or_slug: "example" },
    })).rejects.toBe(nested);
  });

  test("preserves custom-fetch exceptions and cancellation without inventing an HTTP response", async () => {
    const inner = new Error("Credential store unavailable");
    const custom = new Error("Login is required", { cause: inner });
    const aborted = new DOMException("Cancelled by caller", "AbortError");
    for (const failure of [custom, aborted, undefined]) {
      const observed: unknown[] = [];
      const sentry = createSentryClient({
        baseUrl: "https://example.test",
        fetch: asFetch(async () => { throw failure; }),
      });
      sentry.client.interceptors.error.use(error => { observed.push(error); return error; });
      const result = await sentry.listOrganizations();
      expect("error" in result).toBe(true);
      expect(result.error).toBe(failure);
      expect(result.response).toBeUndefined();
      expect(result.request).toBeInstanceOf(Request);
      await expect(sentry.listOrganizations({ throwOnError: true })).rejects.toBe(failure);
      expect(observed).toEqual([failure, failure]);
    }
    expect(custom.cause).toBe(inner);
  });

  test("does not normalize serializer, validator or interceptor failures as network errors", async () => {
    for (const stage of ["serialize", "request-validation", "request-interceptor", "response-interceptor", "response-validation", "transform"] as const) {
      const failure = new Error(stage);
      const observed: unknown[] = [];
      const sentry = createSentryClient({
        baseUrl: "https://example.test",
        fetch: asFetch(async () => Response.json([])),
      });
      sentry.client.interceptors.error.use(error => { observed.push(error); return error; });
      const fail = () => { throw failure; };
      if (stage === "request-interceptor") sentry.client.interceptors.request.use(fail);
      if (stage === "response-interceptor") sentry.client.interceptors.response.use(fail);
      const call = stage === "serialize"
        ? sentry.createOrganizationDashboard({
            path: { organization_id_or_slug: "example" },
            body: { title: "Overview" }, bodySerializer: fail,
          })
        : sentry.listOrganizations({
            requestValidator: stage === "request-validation" ? fail : undefined,
            responseValidator: stage === "response-validation" ? fail : undefined,
            responseTransformer: stage === "transform" ? fail : undefined,
          });
      await expect(call).rejects.toBe(failure);
      expect(observed).toEqual([]);
    }
  });

  test("does not relabel invalid success JSON or failing response streams as transport errors", async () => {
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(async () => new Response("{", { headers: { "Content-Type": "application/json" } })),
    });
    await expect(sentry.listOrganizations()).rejects.toBeInstanceOf(SyntaxError);

    for (const status of [200, 500]) {
      const failure = new TypeError("Body stream failed");
      const fetch = asFetch(async () => new Response(new ReadableStream({
        start(controller) { controller.error(failure); },
      }), { status, headers: { "Content-Type": "application/json" } }));
      await expect(sentry.listOrganizations({ fetch })).rejects.toBe(failure);
    }
  });
});
