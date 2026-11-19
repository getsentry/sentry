import { describe, expect, test, vi } from "vitest";
import { createSentryClient, listOrganizations, type Config } from "@sentry/api";
import { createBrowserFetch } from "@sentry/api/browser";

const asFetch = (implementation: (request: Request) => Promise<Response>) =>
  ((input: RequestInfo | URL, init?: RequestInit) =>
    implementation(input instanceof Request && init === undefined ? input : new Request(input, init))) as NonNullable<Config["fetch"]>;

describe("operation cancellation", () => {
  for (const style of ["bound", "standalone"] as const) {
    test(`${style} operations stop before injected fetch and preserve the abort reason in both error modes`, async () => {
      let requests = 0;
      const sentry = createSentryClient({
        baseUrl: "https://example.test",
        fetch: asFetch(async () => { requests++; return Response.json([]); }),
      });

      for (const reason of [new Error("Cancelled by caller"), "Tool cancelled", null, false, 0, "", undefined]) {
        const controller = new AbortController();
        controller.abort(reason);
        const options = { signal: controller.signal };
        const result = style === "bound"
          ? await sentry.listOrganizations(options)
          : await listOrganizations({ ...options, client: sentry.client });

        expect("error" in result).toBe(true);
        expect(result.error).toBe(controller.signal.reason);
        expect(result.response).toBeUndefined();
        expect(result.request.signal.aborted).toBe(true);
        expect(result.request.signal.reason).toBe(controller.signal.reason);

        const throwing = style === "bound"
          ? sentry.listOrganizations({ ...options, throwOnError: true })
          : listOrganizations({ ...options, client: sentry.client, throwOnError: true });
        await expect(throwing).rejects.toBe(controller.signal.reason);
      }

      expect(requests).toBe(0);
    });
  }

  test("passes cancellation through the configured error mapper with the request and no response", async () => {
    const reason = new Error("Command cancelled");
    const mapped = new Error("Application cancellation");
    const controller = new AbortController();
    controller.abort(reason);
    const seen: Request[] = [];
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(async () => { throw new Error("Fetch must not run"); }),
    });
    sentry.client.interceptors.error.use((error, response, request) => {
      expect(error).toBe(reason);
      expect(response).toBeUndefined();
      expect(request.signal.reason).toBe(reason);
      seen.push(request);
      return mapped;
    });

    const result = await sentry.listOrganizations({ signal: controller.signal });
    expect(result.error).toBe(mapped);
    expect(result.request).toBe(seen[0]!);
    expect(result.response).toBeUndefined();
    await expect(listOrganizations({
      client: sentry.client, signal: controller.signal, throwOnError: true,
    })).rejects.toBe(mapped);
    expect(seen).toHaveLength(2);
  });

  test("does not dispatch when cancelled during an asynchronous request interceptor", async () => {
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const controller = new AbortController();
    const reason = new Error("Cancelled during preparation");
    let requests = 0;
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(async () => { requests++; return Response.json([]); }),
    });
    sentry.client.interceptors.request.use(async request => {
      entered.resolve();
      await release.promise;
      return request;
    });

    const pending = sentry.listOrganizations({ signal: controller.signal });
    await entered.promise;
    controller.abort(reason);
    release.resolve();

    const result = await pending;
    expect(result.error).toBe(reason);
    expect(result.response).toBeUndefined();
    expect(requests).toBe(0);
  });

  test("per-call signals, including null, replace the client default without changing it", async () => {
    const defaultController = new AbortController();
    const callController = new AbortController();
    const reason = new Error("Default cancelled");
    defaultController.abort(reason);
    const requests: Request[] = [];
    const sentry = createSentryClient({
      baseUrl: "https://example.test", signal: defaultController.signal,
      fetch: asFetch(async request => { requests.push(request); return Response.json([]); }),
    });

    const overridden = await sentry.listOrganizations({ signal: callController.signal });
    const cleared = await listOrganizations({ client: sentry.client, signal: null });
    const inherited = await sentry.listOrganizations();

    expect(overridden.data).toEqual([]);
    expect(cleared.data).toEqual([]);
    expect(inherited.error).toBe(reason);
    expect(requests).toHaveLength(2);
    expect(requests.every(request => !request.signal.aborted)).toBe(true);
    expect(sentry.client.getConfig().signal).toBe(defaultController.signal);
    callController.abort("Only this call");
    expect(overridden.request.signal.reason).toBe("Only this call");
    expect(cleared.request.signal.aborted).toBe(false);
  });

  test("checks the final Request signal after an interceptor replaces it", async () => {
    const controller = new AbortController();
    const reason = new Error("Replacement cancelled");
    controller.abort(reason);
    let requests = 0;
    const fetch = asFetch(async () => { requests++; return Response.json([]); });
    const cancelled = createSentryClient({ baseUrl: "https://example.test", fetch });
    cancelled.client.interceptors.request.use(request =>
      new Request(request, { signal: controller.signal }));
    expect((await cancelled.listOrganizations()).error).toBe(reason);

    const replacement = new AbortController();
    const replaced = createSentryClient({ baseUrl: "https://example.test", fetch });
    replaced.client.interceptors.request.use(request => new Request(request, { signal: replacement.signal }));
    expect((await replaced.listOrganizations({ signal: controller.signal })).data).toEqual([]);
    expect(requests).toBe(1);
  });

  test("cancelling an in-flight operation does not cancel another operation on the shared client", async () => {
    const started = Promise.withResolvers<void>();
    const survivor = Promise.withResolvers<Response>();
    const firstController = new AbortController();
    const secondController = new AbortController();
    const reason = new Error("First operation cancelled");
    const requests: Request[] = [];
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(request => {
        requests.push(request);
        if (requests.length === 2) started.resolve();
        return new Promise<Response>((resolve, reject) => {
          const abort = () => reject(request.signal.reason);
          request.signal.addEventListener("abort", abort, { once: true });
          if (request.headers.get("X-Operation") === "second") {
            void survivor.promise.then(response => {
              request.signal.removeEventListener("abort", abort);
              resolve(response);
            });
          }
        });
      }),
    });

    const cancelled = sentry.listOrganizations({ signal: firstController.signal });
    const successful = listOrganizations({
      client: sentry.client, signal: secondController.signal,
      headers: { "X-Operation": "second" }, throwOnError: true,
    });
    await started.promise;
    firstController.abort(reason);
    const result = await cancelled;
    expect(result.error).toBe(reason);
    expect(result.response).toBeUndefined();
    expect(secondController.signal.aborted).toBe(false);
    const response = Response.json([]);
    survivor.resolve(response);
    expect((await successful).response).toBe(response);
    expect(requests).toHaveLength(2);
  });

  test("preserves the winning reason of a caller-composed cancellation signal", async () => {
    for (const winner of ["caller", "timeout"] as const) {
      const caller = new AbortController();
      const timeout = new AbortController();
      const callerReason = new Error("User cancelled");
      const timeoutReason = new DOMException("Deadline exceeded", "TimeoutError");
      const signal = AbortSignal.any([caller.signal, timeout.signal]);
      const sentry = createSentryClient({
        baseUrl: "https://example.test",
        fetch: asFetch(async () => { throw new Error("Fetch must not run"); }),
      });
      if (winner === "caller") {
        caller.abort(callerReason);
        timeout.abort(timeoutReason);
      } else {
        timeout.abort(timeoutReason);
        caller.abort(callerReason);
      }

      const result = await sentry.listOrganizations({ signal });
      expect(result.error).toBe(winner === "caller" ? callerReason : timeoutReason);
      expect(result.response).toBeUndefined();
    }
  });

  test("body-read cancellation still rejects directly without running transport error mappers", async () => {
    for (const status of [200, 500]) {
      const reading = Promise.withResolvers<void>();
      const controller = new AbortController();
      const reason = new Error("Cancelled while reading response body");
      const mapped: unknown[] = [];
      class ObservedResponse extends Response {
        override json() { reading.resolve(); return super.json(); }
        override text() { reading.resolve(); return super.text(); }
      }
      const sentry = createSentryClient({
        baseUrl: "https://example.test",
        fetch: asFetch(async request => new ObservedResponse(new ReadableStream({
          start(stream) {
            request.signal.addEventListener("abort", () => stream.error(request.signal.reason), { once: true });
          },
        }), { status, headers: { "Content-Type": "application/json" } })),
      });
      sentry.client.interceptors.error.use(error => { mapped.push(error); return error; });

      const pending = sentry.listOrganizations({ signal: controller.signal });
      await reading.promise;
      controller.abort(reason);
      await expect(pending).rejects.toBe(reason);
      expect(mapped).toEqual([]);
    }
  });

  test("browser fetch detaches an aborted Request with an explicit null signal", async () => {
    const request = new Request("https://example.test/api/0/organizations/", {
      signal: AbortSignal.abort(new Error("Original cancelled")),
    });
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      expect(new Request(input, init).signal.aborted).toBe(false);
      return Response.json([]);
    });
    try {
      const response = await createBrowserFetch()(request, { signal: null });
      expect(await response.json()).toEqual([]);
      expect(request.signal.aborted).toBe(true);
    } finally {
      fetch.mockRestore();
    }
  });

  test("respects an interceptor clearing the caller's aborted signal", async () => {
    let dispatched = 0;
    const sentry = createSentryClient({
      baseUrl: "https://example.test",
      fetch: asFetch(async request => {
        expect(request.signal.aborted).toBe(false);
        dispatched++;
        return Response.json([]);
      }),
    });
    sentry.client.interceptors.request.use(request => new Request(request, { signal: null }));

    const result = await sentry.listOrganizations({
      signal: AbortSignal.abort(new Error("Caller cancelled")),
      throwOnError: true,
    });
    expect(result.data).toEqual([]);
    expect(dispatched).toBe(1);
  });
});
