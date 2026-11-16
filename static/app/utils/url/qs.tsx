/**
 * Query string helpers built on the browser's URI encoding functions.
 *
 * The output matches what `query-string@7` produced with default options, so
 * existing URLs, cache keys and tests keep working: keys are sorted, arrays
 * repeat their key, `null` is written as a bare key, `undefined` is left out,
 * and `!'()*` are percent-encoded. `Date` values are written as ISO strings,
 * and other objects go through `String()` instead of throwing.
 */

export type ParsedQuery<T = string> = Record<string, T | T[] | null>;

interface ParsedUrl {
  query: ParsedQuery;
  url: string;
}

interface StringifyOptions {
  /**
   * Leave out keys and array items whose value is `null`.
   */
  skipNull?: boolean;
}

interface UrlObject {
  url: string;
  /**
   * Overrides the parameters already in `url`.
   */
  query?: Record<PropertyKey, unknown>;
}

const PERCENT_TRIPLETS = /(?:%[0-9a-f]{2})+/gi;

/**
 * Decodes the longest valid parts of a run of percent-encoded bytes and keeps
 * the bytes that are not valid UTF-8 as they were typed, like `100%` or a
 * truncated `%E0%A4`.
 */
function decodeTriplets(run: string): string {
  const bytes = run.match(/%[0-9a-f]{2}/gi) ?? [];
  let result = '';
  let index = 0;

  while (index < bytes.length) {
    let decoded: string | undefined;
    let length = 1;
    // A UTF-8 character is at most 4 bytes.
    for (; length <= 4 && index + length <= bytes.length; length++) {
      try {
        decoded = decodeURIComponent(bytes.slice(index, index + length).join(''));
        break;
      } catch {
        // Try one more byte.
      }
    }

    if (decoded === undefined) {
      result += bytes[index];
      index += 1;
    } else {
      result += decoded;
      index += length;
    }
  }

  return result;
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value.replace(PERCENT_TRIPLETS, run => {
      try {
        return decodeURIComponent(run);
      } catch {
        return decodeTriplets(run);
      }
    });
  }
}

function encode(value: unknown): string {
  const text =
    value instanceof Date && !Number.isNaN(value.getTime())
      ? value.toISOString()
      : String(value);

  return encodeURIComponent(text).replace(
    /[!'()*]/g,
    char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function removeHash(url: string): string {
  const hashStart = url.indexOf('#');
  return hashStart === -1 ? url : url.slice(0, hashStart);
}

function removeQuery(url: string): string {
  const withoutHash = removeHash(url);
  const queryStart = withoutHash.indexOf('?');
  return queryStart === -1 ? withoutHash : withoutHash.slice(0, queryStart);
}

function extract(url: string): string {
  const withoutHash = removeHash(url);
  const queryStart = withoutHash.indexOf('?');
  return queryStart === -1 ? '' : withoutHash.slice(queryStart + 1);
}

/**
 * Parses a query string. A leading `?`, `#` or `&` is ignored, so
 * `location.search` can be passed directly.
 *
 * Repeated keys become arrays, a key without `=` becomes `null`, and `+` is
 * decoded as a space. The result has sorted keys and no prototype.
 */
export function parse(query: string): ParsedQuery {
  const parsed: ParsedQuery = Object.create(null);

  if (typeof query !== 'string') {
    return parsed;
  }

  for (const param of query
    .trim()
    .replace(/^[?#&]/, '')
    .split('&')) {
    if (param === '') {
      continue;
    }

    const plusDecoded = param.replace(/\+/g, ' ');
    const separator = plusDecoded.indexOf('=');
    const key = decode(separator === -1 ? plusDecoded : plusDecoded.slice(0, separator));
    const value = separator === -1 ? null : decode(plusDecoded.slice(separator + 1));

    const existing = parsed[key];
    if (existing === undefined) {
      parsed[key] = value;
    } else {
      // Like query-string, a repeated key without `=` puts `null` in the array.
      parsed[key] = [
        ...(Array.isArray(existing) ? existing : [existing]),
        value,
      ] as string[];
    }
  }

  const sorted: ParsedQuery = Object.create(null);
  for (const key of Object.keys(parsed).sort()) {
    sorted[key] = parsed[key]!;
  }
  return sorted;
}

/**
 * Converts an object to a query string without a leading `?`, sorted by key.
 */
export function stringify(
  object: Record<PropertyKey, unknown> | null | undefined,
  options: StringifyOptions = {}
): string {
  if (!object) {
    return '';
  }

  const isSkipped = (value: unknown) =>
    value === undefined || (options.skipNull && value === null);

  const params: string[] = [];
  for (const key of Object.keys(object).sort()) {
    const value = object[key];
    const values = Array.isArray(value) ? value : [value];

    for (const item of values) {
      if (isSkipped(item)) {
        continue;
      }
      params.push(item === null ? encode(key) : `${encode(key)}=${encode(item)}`);
    }
  }

  return params.join('&');
}

/**
 * Splits a URL into the part before `?` and its parsed query. The hash is
 * dropped.
 */
export function parseUrl(url: string): ParsedUrl {
  return {
    url: removeQuery(url),
    query: parse(extract(url)),
  };
}

/**
 * Builds a URL from `url` and `query`. Parameters in `query` replace the ones
 * already in `url`, and the hash in `url` is kept.
 */
export function stringifyUrl(
  {url, query}: UrlObject,
  options: StringifyOptions = {}
): string {
  const hashStart = url.indexOf('#');
  const hash = hashStart === -1 ? '' : url.slice(hashStart);
  const search = stringify({...parse(extract(url)), ...query}, options);

  return `${removeQuery(url)}${search ? `?${search}` : ''}${hash}`;
}
