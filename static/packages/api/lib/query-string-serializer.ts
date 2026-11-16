/**
 * An opt-in query serializer for `createSentryClient({ querySerializer })`.
 * The client's default stays as it is: it keeps the query's key order, omits
 * `null` and `undefined`, repeats array values (`a=1&a=2`) and writes objects
 * in `deepObject` style (`a[b]=1`).
 */

// The characters `encodeURIComponent` leaves alone but RFC 3986 reserves.
const STRICT_RESERVED = /[!'()*]/g;

function encode(value: unknown): string {
  return encodeURIComponent(String(value)).replace(
    STRICT_RESERVED,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * Serialize a query as `query-string@7`'s `stringify` does with its default
 * options, for consumers whose URLs, cache keys or snapshots already depend
 * on that output:
 *
 * - keys are sorted by UTF-16 code unit;
 * - `null` becomes a bare key (`a`), `undefined` is omitted, and `""` stays
 *   as `a=`;
 * - arrays repeat the key (`a=1&a=2`), with the same rules per item, and an
 *   empty array is omitted;
 * - other values are stringified, so objects are not expanded;
 * - keys and values are percent-encoded, including `!'()*`.
 *
 * @example
 * ```ts
 * const sentry = createSentryClient({ querySerializer: queryStringSerializer });
 * ```
 */
export function queryStringSerializer(query: Record<string, unknown>): string {
  const pair = (key: string, value: unknown) => (value === null ? encode(key) : `${encode(key)}=${encode(value)}`);
  return Object.keys(query)
    .sort()
    .map((key) => {
      const value = query[key];
      if (value === undefined) return "";
      if (!Array.isArray(value)) return pair(key, value);
      return value.filter((item) => item !== undefined).map((item) => pair(key, item)).join("&");
    })
    // Like query-string, drop keys that serialize to nothing, such as a bare empty key.
    .filter((part) => part !== "")
    .join("&");
}
