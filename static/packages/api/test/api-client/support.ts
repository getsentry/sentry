/**
 * Test helpers: a core whose transport is scripted, for endpoint wrappers,
 * and a pass-through body codec for the response cache. The compressing codec
 * needs `node:zlib`, so hosts keep it; the cache only needs a round trip.
 */

import { vi } from "vitest";
import { type ApiTarget, createApiClientCore } from "../../src/api-client/core.ts";
import type {
  BodyCodec,
  EncodedBody,
} from "../../src/api-client/response-cache/body.ts";

export type { EncodedBody };

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

/** A codec that stores bodies as they are. */
export function createBodyCodec(): BodyCodec {
  return {
    async encode(raw) {
      return { bytes: raw.slice(), encoding: "identity", rawSize: raw.length };
    },
    async decode(body) {
      // Like the compressing codec, a dictionary this runtime lacks is a miss.
      if (body.dictId !== undefined) {
        return undefined;
      }
      if (body.encoding !== "identity" || body.bytes.length !== body.rawSize) {
        throw new Error("Unexpected cached body");
      }
      return body.bytes.slice();
    },
  };
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
