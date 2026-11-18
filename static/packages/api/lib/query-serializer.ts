/**
 * The client's query serializer. It writes what `query-string@7`'s `stringify`
 * writes with its default options, and also writes objects in `deepObject`
 * style, which query-string doesn't encode.
 */

// The characters `encodeURIComponent` leaves alone but RFC 3986 reserves.
const STRICT_RESERVED = /[!'()*]/g;

function encode(value: unknown): string {
  const text = value instanceof Date ? value.toISOString() : String(value);
  return encodeURIComponent(text).replace(
    STRICT_RESERVED,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

/** `key=value`, or a bare `key` for `null`; `key` comes encoded. */
function pair(key: string, value: unknown): string {
  if (isObject(value) || Array.isArray(value)) {
    throw new Error("Nested arrays and objects in a query aren't supported. Pass your own `querySerializer` to send them.");
  }
  return value === null ? key : `${key}=${encode(value)}`;
}

/** `key=value` pairs for one value, skipping `undefined` ones; `key` comes encoded. */
function pairs(key: string, value: unknown): string[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value.filter((item) => item !== undefined).map((item) => pair(key, item));
  if (!isObject(value)) return [pair(key, value)];
  return Object.keys(value)
    .sort()
    .filter((name) => value[name] !== undefined)
    .map((name) => pair(`${key}[${encode(name)}]`, value[name]));
}

/**
 * Serialize a query the way the client does by default:
 *
 * - keys are sorted by UTF-16 code unit;
 * - `null` becomes a bare key (`a`), `undefined` is omitted, and `""` stays
 *   as `a=`;
 * - arrays repeat the key (`a=1&a=2`), with the same rules per item, and an
 *   empty array is omitted;
 * - objects are written in `deepObject` style (`a[b]=1`), their keys sorted;
 * - dates are written as ISO strings;
 * - keys and values are percent-encoded, including `!'()*`.
 */
export function serializeQuery(query: Record<string, unknown>): string {
  return Object.keys(query)
    .sort()
    // Like query-string, drop a bare empty key.
    .flatMap((key) => pairs(encode(key), query[key]).filter((part) => part !== ""))
    .join("&");
}
