/** Test helpers: a core whose transport is scripted, for endpoint wrappers. */

import { vi } from "vitest";
import { type ApiTarget, createApiClientCore } from "../../src/api-client/core.ts";
export const ORIGIN = "https://us.sentry.io";

export function jsonResponse(
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", ...headers },
  });
}

/** A `Link` header with a next page at `cursor` for the API `path`. */
export function nextLink(path: string, cursor: string) {
  return {
    link: `<${ORIGIN}/api/0${path}?cursor=${cursor}>; rel="next"; results="true"; cursor="${cursor}"`,
  };
}

/** A target whose transport answers each request with the next response. */
export function scriptedTarget(...responses: Response[]) {
  const request = vi.fn(async (_url: string, _init: RequestInit) => {
    const response = responses.shift();
    if (!response) {
      throw new Error("unexpected request");
    }
    return response;
  });
  const core = createApiClientCore({
    transport: { request },
    headers: () => ({}),
    logger: { warn: vi.fn() },
  });
  const apiTarget: ApiTarget = { core, origin: ORIGIN };
  return { apiTarget, request };
}

/**
 * Retry `assertion` until it passes or `timeoutMs` elapses, for effects the
 * code under test starts without awaiting, such as a fire-and-forget cache write.
 */
export async function waitFor<T>(
  assertion: () => T | Promise<T>,
  timeoutMs = 1000,
): Promise<T> {
  const deadline = performance.now() + timeoutMs;
  for (;;) {
    try {
      return await assertion();
    } catch (error) {
      if (performance.now() > deadline) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
}
