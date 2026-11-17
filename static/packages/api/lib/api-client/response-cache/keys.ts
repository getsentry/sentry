/**
 * Identity-scoped cache keys for Sentry API responses. Uses WebCrypto, so it
 * runs in Node, Cloudflare Workers, and browsers.
 */

const encoder = new TextEncoder();

/**
 * Normalize method + URL into a stable string for cache key derivation.
 * Keeps the host, so the same path on two Sentry servers gets two keys, and
 * sorts query params by name so `?a=1&b=2` and `?b=2&a=1` match.
 *
 * @throws {TypeError} If the URL cannot be parsed
 */
export function normalizeUrl(method: string, url: string): string {
  const parsed = new URL(url);
  const sortedParams = new URLSearchParams(
    [...parsed.searchParams.entries()].sort(([a], [b]) => {
      if (a < b) {
        return -1;
      }
      if (a > b) {
        return 1;
      }
      return 0;
    }),
  );
  parsed.search = sortedParams.toString() ? `?${sortedParams.toString()}` : "";
  return `${method.toUpperCase()}|${parsed.toString()}`;
}

/**
 * Build a cache key from the requesting identity, method, and URL: the
 * hex HMAC-SHA256 of {@link normalizeUrl} keyed by `identity`.
 *
 * `identity` scopes entries so one user never receives another's response.
 * It must be a stable hash of who is asking, never a raw token, and should
 * not change when an access token is refreshed for the same login. Keys
 * match `node:crypto`'s `createHmac("sha256", identity)`, so entries written
 * before this module moved here are still found.
 *
 * @throws {TypeError} If `identity` is empty or the URL cannot be parsed
 */
export async function buildCacheKey(
  method: string,
  url: string,
  identity: string,
): Promise<string> {
  if (!identity) {
    throw new TypeError("A cache key needs a non-empty identity");
  }
  const normalized = normalizeUrl(method, url);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(identity),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(normalized),
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
