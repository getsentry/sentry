/**
 * Tests for the Objectstore client. A fetch is injected so URL construction,
 * the `x-os-auth` header, the batch request/response protocol, and the PUT
 * request shape can be checked without a network.
 */

import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../src/api-client/errors.ts";
import {
  findExistingObjects,
  type ObjectstoreConfig,
  ObjectstoreError,
  type ObjectUpload,
  putObjects,
} from "../../src/api-client/objectstore.ts";

const config: ObjectstoreConfig = {
  url: "https://objectstore.example.com/",
  usecase: "preprod_snapshots",
  scopes: [
    ["org", "123"],
    ["project", "456"],
  ],
  authToken: "jwt-token",
  expirationPolicy: "ttl:30d",
};

type FetchMock = ReturnType<typeof vi.fn<(input: string, init?: RequestInit) => Promise<Response>>>;

function mockFetch(): FetchMock {
  return vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();
}

/** Build a batch response in the server's `multipart/form-data` shape. */
function batchResponse(parts: { index: number; status: string; body?: string }[]): Response {
  const boundary = "os-boundary-00000000000000000000000000000abc";
  let text = "";
  for (const part of parts) {
    text +=
      `--${boundary}\r\n` +
      `x-sn-batch-operation-index: ${part.index}\r\n` +
      `x-sn-batch-operation-status: ${part.status}\r\n` +
      "content-disposition: form-data; name=part\r\n\r\n" +
      `${part.body ?? ""}\r\n`;
  }
  text += `--${boundary}--`;
  return new Response(text, {
    status: 200,
    headers: { "content-type": `multipart/form-data; boundary="${boundary}"` },
  });
}

/** Decode a captured batch request body as multipart form data. */
async function sentParts(init: RequestInit): Promise<FormDataEntryValue[]> {
  const headers = init.headers as Record<string, string>;
  const form = await new Response(init.body as BodyInit, {
    headers: { "content-type": headers["content-type"] as string },
  }).formData();
  return form.getAll("part");
}

function rawBody(init: RequestInit): string {
  return new TextDecoder("latin1").decode(init.body as Uint8Array);
}

function upload(key: string, bytes: Uint8Array<ArrayBuffer>): ObjectUpload & { reads: number } {
  const item = {
    key,
    size: bytes.byteLength,
    reads: 0,
    read: async () => {
      item.reads += 1;
      return bytes;
    },
  };
  return item;
}

const OBJECTS_URL = "https://objectstore.example.com/v1/objects/preprod_snapshots/org=123;project=456";
/** Over the 1 MB batch part limit, so it is PUT on its own. */
const LARGE = 1024 * 1024 + 1;

describe("findExistingObjects", () => {
  it("sends all HEADs in one batch request and returns existing keys", async () => {
    const fetch = mockFetch().mockResolvedValue(
      batchResponse([
        { index: 1, status: "404 Not Found" },
        { index: 0, status: "200 OK" },
        { index: 2, status: "200 OK" },
      ]),
    );

    const existing = await findExistingObjects(config, ["k0", "k1", "k2"], { fetch });

    expect([...existing].sort()).toEqual(["k0", "k2"]);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://objectstore.example.com/v1/objects:batch/preprod_snapshots/org=123;project=456/",
    );
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["x-os-auth"]).toBe("Bearer jwt-token");
    expect(await sentParts(init)).toHaveLength(3);
    const raw = rawBody(init);
    expect(raw).toContain("x-sn-batch-operation-kind: head\r\n");
    expect(raw).toContain("x-sn-batch-operation-key: k1\r\n");
  });

  it("percent-encodes `%`, controls, and non-ASCII in operation keys", async () => {
    const fetch = mockFetch().mockResolvedValue(batchResponse([{ index: 0, status: "404 Not Found" }]));

    await findExistingObjects(config, ["100% r\u00e9port\n"], { fetch });

    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(rawBody(init)).toContain("x-sn-batch-operation-key: 100%25 r%C3%A9port%0A\r\n");
  });

  it("splits more than 1000 keys into batches sent concurrently", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetch = mockFetch().mockImplementation(async (_url, init) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      const count = (await sentParts(init as RequestInit)).length;
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight -= 1;
      return batchResponse(Array.from({ length: count }, (_, index) => ({ index, status: "200 OK" })));
    });
    const keys = Array.from({ length: 2500 }, (_, i) => `k${i}`);

    const existing = await findExistingObjects(config, keys, { fetch });

    expect(existing.size).toBe(2500);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(maxInFlight).toBe(3);
  });

  it("starts no queued batch after one fails", async () => {
    // Five batches, four in flight: the first fails before the others finish.
    const fetch = mockFetch().mockImplementation(async (_url, init) => {
      const call = fetch.mock.calls.length;
      const count = (await sentParts(init as RequestInit)).length;
      if (call === 1) {
        return new Response(null, { status: 429 });
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
      return batchResponse(Array.from({ length: count }, (_, index) => ({ index, status: "200 OK" })));
    });
    const keys = Array.from({ length: 5000 }, (_, i) => `k${i}`);

    await expect(findExistingObjects(config, keys, { fetch })).rejects.toThrow(ObjectstoreError);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("throws on a per-operation error other than 404", async () => {
    const fetch = mockFetch().mockResolvedValue(
      batchResponse([
        { index: 0, status: "200 OK" },
        { index: 1, status: "429 Too Many Requests", body: "slow down — retry" },
      ]),
    );
    const error = await findExistingObjects(config, ["k0", "k1"], { fetch }).catch((e) => e);
    expect(error).toBeInstanceOf(ObjectstoreError);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(429);
    expect(error.detail).toBe("slow down — retry");
    expect(error.url).toBe(`${OBJECTS_URL}/k1`);
  });

  it("throws when the batch request itself fails", async () => {
    const fetch = mockFetch().mockResolvedValue(
      new Response(null, { status: 429, statusText: "Too Many Requests" }),
    );
    const error = await findExistingObjects(config, ["k0"], { fetch }).catch((e) => e);
    expect(error).toBeInstanceOf(ObjectstoreError);
    expect(error.status).toBe(429);
    expect(error.detail).toBe("Too Many Requests");
  });

  it("throws when the response is missing an operation", async () => {
    const fetch = mockFetch().mockResolvedValue(batchResponse([{ index: 0, status: "200 OK" }]));
    await expect(findExistingObjects(config, ["k0", "k1"], { fetch })).rejects.toThrow(
      ObjectstoreError,
    );
  });

  it("throws when the response is not multipart", async () => {
    const fetch = mockFetch().mockResolvedValue(
      new Response("{}", { headers: { "content-type": "application/json" } }),
    );
    const error = await findExistingObjects(config, ["k0"], { fetch }).catch((e) => e);
    expect(error).toBeInstanceOf(ObjectstoreError);
    expect(error.status).toBe(502);
  });
});

describe("putObjects", () => {
  it("batches small uploads and PUTs uploads over the batch part limit", async () => {
    const small = upload("1/2/small", new Uint8Array([1, 2, 3]));
    const large = upload("1/2/large", new Uint8Array(LARGE));
    const fetch = mockFetch().mockImplementation(async (_url, init) =>
      init?.method === "POST"
        ? batchResponse([{ index: 0, status: "201 Created" }])
        : new Response(null, { status: 201 }),
    );

    await putObjects(config, [small, large], { fetch });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(small.reads).toBe(1);
    expect(large.reads).toBe(1);
    const [, batchInit] = fetch.mock.calls.find(([, init]) => init?.method === "POST") as [
      string,
      RequestInit,
    ];
    const parts = await sentParts(batchInit);
    expect(parts).toHaveLength(1);
    // Parts without a filename decode as strings.
    expect(parts[0]).toBe("\x01\x02\x03");
    const raw = rawBody(batchInit);
    expect(raw).toContain("x-sn-batch-operation-kind: insert\r\n");
    expect(raw).toContain("x-sn-batch-operation-key: 1/2/small\r\n");
    expect(raw).toContain("x-sn-expiration: ttl:30d\r\n");

    const [putUrl] = fetch.mock.calls.find(([, init]) => init?.method === "PUT") as [string];
    expect(putUrl).toBe(`${OBJECTS_URL}/1/2/large`);
  });

  it("splits uploads over 25 MB into batches sent concurrently", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetch = mockFetch().mockImplementation(async (_url, init) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      const count = (await sentParts(init as RequestInit)).length;
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight -= 1;
      return batchResponse(
        Array.from({ length: count }, (_, index) => ({ index, status: "201 Created" })),
      );
    });
    // 60 uploads of 1 MB: three batches of at most 25 MB each.
    const uploads = Array.from({ length: 60 }, (_, i) => upload(`k${i}`, new Uint8Array(1024 * 1024)));

    await putObjects(config, uploads, { fetch });

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(maxInFlight).toBe(3);
    expect(uploads.every((u) => u.reads === 1)).toBe(true);
  });

  it("reads one upload at a time within a batch", async () => {
    let reading = 0;
    let maxReading = 0;
    const uploads = Array.from({ length: 50 }, (_, i): ObjectUpload => ({
      key: `k${i}`,
      size: 1,
      read: async () => {
        reading += 1;
        maxReading = Math.max(maxReading, reading);
        await new Promise((resolve) => setTimeout(resolve, 1));
        reading -= 1;
        return new Uint8Array([i]);
      },
    }));
    const fetch = mockFetch().mockResolvedValue(
      batchResponse(uploads.map((_, index) => ({ index, status: "201 Created" }))),
    );

    await putObjects(config, uploads, { fetch });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(maxReading).toBe(1);
  });

  it("starts and reads no queued upload after one fails", async () => {
    // Six large uploads, five PUTs in flight: the first fails before the others finish.
    const fetch = mockFetch().mockImplementation(async () => {
      if (fetch.mock.calls.length === 1) {
        return new Response(null, { status: 429 });
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(null, { status: 201 });
    });
    const uploads = Array.from({ length: 6 }, (_, i) => upload(`k${i}`, new Uint8Array(LARGE)));

    await expect(putObjects(config, uploads, { fetch })).rejects.toThrow(ObjectstoreError);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(fetch).toHaveBeenCalledTimes(5);
    expect(uploads[5]?.reads).toBe(0);
  });

  it("throws when an insert in the batch fails", async () => {
    const fetch = mockFetch().mockResolvedValue(
      batchResponse([{ index: 0, status: "500 Internal Server Error" }]),
    );
    await expect(
      putObjects(config, [upload("k", new Uint8Array([1]))], { fetch }),
    ).rejects.toThrow(ObjectstoreError);
  });
});

describe("individual PUTs", () => {
  it("PUTs the body with auth + expiration headers", async () => {
    const fetch = mockFetch().mockResolvedValue(new Response(null, { status: 200 }));

    await putObjects(config, [upload("1/2/abc", new Uint8Array(LARGE))], { fetch });

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${OBJECTS_URL}/1/2/abc`);
    expect(init.method).toBe("PUT");
    expect((init.body as Uint8Array).byteLength).toBe(LARGE);
    const headers = init.headers as Record<string, string>;
    expect(headers["x-os-auth"]).toBe("Bearer jwt-token");
    expect(headers["x-sn-expiration"]).toBe("ttl:30d");
  });

  it("percent-encodes key segments in the object URL", async () => {
    const fetch = mockFetch().mockResolvedValue(new Response(null, { status: 200 }));

    await putObjects(config, [upload("1/a b%?#^\\c/r\u00e9", new Uint8Array(LARGE))], { fetch });

    const [url] = fetch.mock.calls[0] as [string];
    expect(url).toBe(`${OBJECTS_URL}/1/a%20b%25%3F%23%5E%5Cc/r%C3%A9`);
    expect(new URL(url).pathname).toMatch(/\/1\/a%20b%25%3F%23%5E%5Cc\/r%C3%A9$/);
  });

  it("omits the auth header without a token", async () => {
    const fetch = mockFetch().mockResolvedValue(new Response(null, { status: 200 }));

    await putObjects({ ...config, authToken: null }, [upload("k", new Uint8Array(LARGE))], {
      fetch,
    });

    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(init.headers as Record<string, string>).not.toHaveProperty("x-os-auth");
  });

  it("throws on a non-2xx response", async () => {
    const fetch = mockFetch().mockResolvedValue(
      new Response(null, { status: 403, statusText: "Forbidden" }),
    );
    const error = await putObjects(config, [upload("k", new Uint8Array(LARGE))], { fetch }).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ObjectstoreError);
    expect(error.status).toBe(403);
    expect(error.url).toBe(`${OBJECTS_URL}/k`);
  });
});
