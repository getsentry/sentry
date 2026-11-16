import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBodyCodec,
  type EncodedBody,
} from "../support.ts";
import { buildCacheKey } from "../../../src/api-client/response-cache/keys.ts";
import { createMemoryStore, ENTRY_OVERHEAD_BYTES } from "../../../src/api-client/response-cache/memory-store.ts";
import type { CacheEntry } from "../../../src/api-client/response-cache/store.ts";

const API = "https://us.sentry.io/api/0";
const MINUTE = 60_000;
const encoder = new TextEncoder();
const codec = createBodyCodec();

/** A stored body of exactly `size` bytes. */
function bodyOfSize(size: number, rawSize = size): EncodedBody {
  return { bytes: new Uint8Array(size), encoding: "identity", rawSize };
}

function entry(
  url: string,
  body: EncodedBody,
  identity = "identity-a",
): CacheEntry {
  return {
    url,
    identity,
    tier: "stable",
    status: 200,
    headers: {},
    body,
    policy: {},
    createdAt: Date.now(),
  };
}

/** A trace-like JSON body: many similar spans, as real traces have. */
function traceBody(targetBytes: number): Uint8Array {
  const spans: string[] = [];
  let size = 0;
  for (let i = 0; size < targetBytes; i++) {
    const span = JSON.stringify({
      span_id: i.toString(16).padStart(16, "0"),
      parent_span_id: (i >> 1).toString(16).padStart(16, "0"),
      op: i % 3 === 0 ? "db.query" : "http.client",
      description: `SELECT * FROM sentry_groupedmessage WHERE id = ${i}`,
      start_timestamp: 1_700_000_000 + i / 1000,
      duration: (i % 97) + 0.25,
    });
    spans.push(span);
    size += span.length + 1;
  }
  return encoder.encode(`[${spans.join(",")}]`);
}

describe("createMemoryStore", () => {
  beforeEach(() => {
    vi.setSystemTime(Date.now());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a stored entry whose body decodes to the original", async () => {
    const store = createMemoryStore();
    const url = `${API}/organizations/acme/issues/?query=is%3Aunresolved`;
    const raw = traceBody(4096);
    const key = await buildCacheKey("GET", url, "identity-a");

    await store.set(key, entry(url, await codec.encode(raw)), MINUTE);
    const cached = await store.get(key);

    expect(cached?.url).toBe(url);
    expect(cached && (await codec.decode(cached.body))).toEqual(raw);
    expect(await store.get("some-other-key")).toBeUndefined();
  });

  it("drops an entry once its TTL has passed", async () => {
    const store = createMemoryStore();
    await store.set("k", entry(`${API}/issues/1/`, bodyOfSize(10)), MINUTE);

    vi.setSystemTime(Date.now() + MINUTE - 1);
    expect(await store.get("k")).toBeDefined();

    vi.setSystemTime(Date.now() + 1);
    expect(await store.get("k")).toBeUndefined();
    expect(store.stats()).toEqual({ entries: 0, bytes: 0 });
  });

  it("does not store an entry without a positive TTL", async () => {
    const store = createMemoryStore();
    await store.set("zero", entry(`${API}/a/`, bodyOfSize(10)), 0);
    await store.set("nan", entry(`${API}/b/`, bodyOfSize(10)), Number.NaN);

    expect(store.stats().entries).toBe(0);
  });

  it("evicts the least recently used entry when over budget", async () => {
    const size = 100 + ENTRY_OVERHEAD_BYTES;
    const store = createMemoryStore({ maxBytes: size * 3 });
    for (const key of ["a", "b", "c"]) {
      await store.set(key, entry(`${API}/${key}/`, bodyOfSize(100)), MINUTE);
    }

    // Reading `a` makes `b` the least recently used.
    await store.get("a");
    await store.set("d", entry(`${API}/d/`, bodyOfSize(100)), MINUTE);

    expect(await store.get("b")).toBeUndefined();
    for (const key of ["a", "c", "d"]) {
      expect(await store.get(key)).toBeDefined();
    }
    expect(store.stats()).toEqual({ entries: 3, bytes: size * 3 });
  });

  it("evicts as many entries as a large one needs", async () => {
    const store = createMemoryStore({ maxBytes: 4 * ENTRY_OVERHEAD_BYTES });
    for (const key of ["a", "b", "c", "d"]) {
      await store.set(key, entry(`${API}/${key}/`, bodyOfSize(0)), MINUTE);
    }

    await store.set(
      "big",
      entry(`${API}/big/`, bodyOfSize(2 * ENTRY_OVERHEAD_BYTES)),
      MINUTE,
    );

    expect(await store.get("a")).toBeUndefined();
    expect(await store.get("b")).toBeUndefined();
    expect(await store.get("c")).toBeUndefined();
    expect(await store.get("d")).toBeDefined();
    expect(await store.get("big")).toBeDefined();
  });

  it("does not store a body over the per-entry cap", async () => {
    const store = createMemoryStore({ maxEntryBytes: 1000 });
    await store.set("k", entry(`${API}/a/`, bodyOfSize(1000)), MINUTE);
    expect(await store.get("k")).toBeDefined();

    // An oversized replacement removes the older response too.
    await store.set("k", entry(`${API}/a/`, bodyOfSize(1001)), MINUTE);

    expect(await store.get("k")).toBeUndefined();
    expect(store.stats()).toEqual({ entries: 0, bytes: 0 });
  });

  it("does not store a body whose original size is over the ceiling", async () => {
    const store = createMemoryStore({ maxRawBytes: 10_000 });
    await store.set("k", entry(`${API}/a/`, bodyOfSize(100, 10_001)), MINUTE);

    expect(await store.get("k")).toBeUndefined();
  });

  it("does not store an entry larger than the whole budget", async () => {
    const store = createMemoryStore({ maxBytes: 2048, maxEntryBytes: 4096 });
    await store.set("small", entry(`${API}/a/`, bodyOfSize(10)), MINUTE);
    await store.set("huge", entry(`${API}/b/`, bodyOfSize(3000)), MINUTE);

    expect(await store.get("huge")).toBeUndefined();
    expect(await store.get("small")).toBeDefined();
  });

  it("stays within its budget when many identities fill it", async () => {
    const maxBytes = 256 * 1024;
    const store = createMemoryStore({ maxBytes });
    let peak = 0;
    let last = "";
    for (let user = 0; user < 500; user++) {
      const identity = `user-${user}`;
      for (let page = 0; page < 10; page++) {
        const url = `${API}/organizations/acme/issues/?cursor=${page}`;
        last = await buildCacheKey("GET", url, identity);
        // Bodies from raw sub-256-byte responses up to 8 KB.
        const body = bodyOfSize(((user * 31 + page * 7) % 64) * 128);
        await store.set(last, entry(url, body, identity), MINUTE);
        peak = Math.max(peak, store.stats().bytes);
      }
    }

    expect(peak).toBeLessThanOrEqual(maxBytes);
    expect(store.stats().entries).toBeGreaterThan(0);
    expect(await store.get(last)).toBeDefined();
  });

  it("deletes only the given identity's entries under a prefix", async () => {
    const store = createMemoryStore();
    const issues = `${API}/organizations/acme/issues/`;
    const projects = `${API}/organizations/acme/projects/`;
    await store.set("a-issues", entry(issues, bodyOfSize(10), "a"), MINUTE);
    await store.set("a-projects", entry(projects, bodyOfSize(10), "a"), MINUTE);
    await store.set("b-issues", entry(issues, bodyOfSize(10), "b"), MINUTE);

    await store.deleteMatching("a", issues);

    expect(await store.get("a-issues")).toBeUndefined();
    expect(await store.get("a-projects")).toBeDefined();
    expect(await store.get("b-issues")).toBeDefined();
    expect(store.stats().entries).toBe(2);
  });

  it("counts a replaced entry only once", async () => {
    const store = createMemoryStore();
    await store.set("k", entry(`${API}/a/`, bodyOfSize(500)), MINUTE);
    await store.set("k", entry(`${API}/a/`, bodyOfSize(200)), MINUTE);

    expect(store.stats()).toEqual({
      entries: 1,
      bytes: 200 + ENTRY_OVERHEAD_BYTES,
    });
  });

  it.each([
    ["Uint8Array", new Uint8Array(1024 * 1024)],
    // `Buffer#slice` shares memory, unlike `Uint8Array#slice`.
    ["Buffer", Buffer.alloc(1024 * 1024)],
  ])("does not keep the larger buffer behind a %s view", async (_, backing) => {
    const store = createMemoryStore();
    const bytes = backing.subarray(100, 400);
    await store.set(
      "k",
      entry(`${API}/a/`, { bytes, encoding: "identity", rawSize: 300 }),
      MINUTE,
    );

    const cached = await store.get("k");

    expect(cached?.body.bytes.buffer.byteLength).toBe(300);
  });

  it.each([
    { maxBytes: 0 },
    { maxEntryBytes: -1 },
    { maxRawBytes: Number.POSITIVE_INFINITY },
  ])("rejects a non-positive or infinite limit: %o", (options) => {
    expect(() => createMemoryStore(options)).toThrow(RangeError);
  });
});
