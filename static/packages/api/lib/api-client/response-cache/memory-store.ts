/**
 * In-memory {@link CacheStore} with a byte budget, for the hosted MCP and
 * tests. Evicts least recently used entries first. Holds no timers: expired
 * entries are dropped when read, or evicted like any other entry.
 */

import type { CacheEntry, CacheStore } from "./store.js";

const MIB = 1024 * 1024;

/**
 * Bytes charged per entry on top of its body, for the key, URL, headers,
 * serialized policy, and bookkeeping. An estimate, so that many small
 * entries (bodies under 256 bytes are stored raw) cannot outgrow the budget.
 */
export const ENTRY_OVERHEAD_BYTES = 1024;

export type MemoryStoreOptions = {
  /** Budget over all entries, in bytes. Defaults to 24 MiB. */
  maxBytes?: number;
  /** Largest stored (compressed) body, in bytes. Defaults to 1 MiB. */
  maxEntryBytes?: number;
  /**
   * Largest original body, in bytes, which bounds memory while decoding.
   * Defaults to 32 MiB.
   */
  maxRawBytes?: number;
};

export type MemoryStore = CacheStore & {
  /** Current entry count and bytes charged against the budget. */
  stats(): { entries: number; bytes: number };
};

type Slot = { entry: CacheEntry; size: number; expiresAt: number };

function limit(name: string, value: number | undefined, fallback: number) {
  if (value === undefined) {
    return fallback;
  }
  if (!(Number.isFinite(value) && value > 0)) {
    throw new RangeError(`${name} must be a positive number, got ${value}`);
  }
  return value;
}

/**
 * Copy `bytes` when it is a view into a larger buffer, so the store never
 * keeps memory it does not count. Copies with the `Uint8Array` constructor,
 * because `Buffer#slice` returns a view that shares the original memory.
 */
function ownBytes(bytes: Uint8Array): Uint8Array {
  return bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? bytes
    : new Uint8Array(bytes);
}

/**
 * Create an empty memory store. Entries are kept by reference; callers must
 * not mutate an entry after storing it or one returned by `get`.
 *
 * @throws {RangeError} If a limit is not a positive number
 */
export function createMemoryStore(
  options: MemoryStoreOptions = {},
): MemoryStore {
  const maxBytes = limit("maxBytes", options.maxBytes, 24 * MIB);
  const maxEntryBytes = limit("maxEntryBytes", options.maxEntryBytes, MIB);
  const maxRawBytes = limit("maxRawBytes", options.maxRawBytes, 32 * MIB);

  // Map order is the LRU order: the first key is the least recently used.
  const slots = new Map<string, Slot>();
  let bytes = 0;

  function remove(key: string): void {
    const slot = slots.get(key);
    if (slot) {
      slots.delete(key);
      bytes -= slot.size;
    }
  }

  return {
    async get(key) {
      const slot = slots.get(key);
      if (!slot) {
        return;
      }
      if (Date.now() >= slot.expiresAt) {
        remove(key);
        return;
      }
      slots.delete(key);
      slots.set(key, slot);
      return slot.entry;
    },

    async set(key, entry, ttlMs) {
      remove(key);
      const stored = entry.body.bytes.byteLength;
      const size = stored + ENTRY_OVERHEAD_BYTES;
      if (
        !(ttlMs > 0) ||
        stored > maxEntryBytes ||
        entry.body.rawSize > maxRawBytes ||
        size > maxBytes
      ) {
        return;
      }
      const body = { ...entry.body, bytes: ownBytes(entry.body.bytes) };
      slots.set(key, {
        entry: { ...entry, body },
        size,
        expiresAt: Date.now() + ttlMs,
      });
      bytes += size;
      // The new entry is last and fits on its own, so this stops before it.
      for (const oldest of slots.keys()) {
        if (bytes <= maxBytes) {
          break;
        }
        remove(oldest);
      }
    },

    async deleteMatching(identity, urlPrefix) {
      for (const [key, slot] of slots) {
        if (
          slot.entry.identity === identity &&
          slot.entry.url.startsWith(urlPrefix)
        ) {
          remove(key);
        }
      }
    },

    stats() {
      return { entries: slots.size, bytes };
    },
  };
}
