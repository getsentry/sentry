const V7_TIMESTAMP_HEX_LENGTH = 12;

const MIN_PLAUSIBLE_MS = Date.UTC(2020, 0, 1);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Sentry log item ids are UUIDv7, whose first 48 bits (12 hex chars) are the
 * creation time in epoch milliseconds. Decoding it lets us query a tight window
 * around the log instead of scanning the org's full retention.
 *
 * Returns null when the id isn't a decodable v7 timestamp so callers can fall
 * back to a wide query.
 */
export function logItemIdToTimestamp(id: string): number | null {
  if (id.length < V7_TIMESTAMP_HEX_LENGTH) {
    return null;
  }

  const hex = id.slice(0, V7_TIMESTAMP_HEX_LENGTH);
  if (!/^[0-9a-f]+$/i.test(hex)) {
    return null;
  }

  const ms = parseInt(hex, 16);
  if (!Number.isFinite(ms) || ms < MIN_PLAUSIBLE_MS || ms > Date.now() + ONE_DAY_MS) {
    return null;
  }

  return ms;
}
