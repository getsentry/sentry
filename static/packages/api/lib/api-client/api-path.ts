import { UserInputError } from "./errors.js";

export { type ApiPathScope, parseApiPathScope } from "./api-path-scope.js";

/**
 * Encode one Sentry API path identifier without letting it become a URL path.
 *
 * URL parsing collapses bare `.` and `..` segments even after
 * `encodeURIComponent`, so callers must reject those identifiers before
 * constructing a request. The caller owns its product-specific error type.
 * A pre-encoded spelling such as `%2e%2e` is safe: encoding its percent signs
 * prevents the URL parser from treating it as a dot segment.
 */
export function encodeApiPathSegment(value: string | number): string | null {
  const text = String(value);
  return text === "." || text === ".." ? null : encodeURIComponent(text);
}

/**
 * Assemble an API URL from a product-validated base and a relative endpoint.
 * This does not decide which host is trusted or which region an org uses.
 */
export function buildSentryApiUrl(baseUrl: string, endpoint: string): string {
  const path = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  let end = baseUrl.length;
  while (end > 0 && baseUrl.charAt(end - 1) === "/") {
    end -= 1;
  }
  return `${baseUrl.slice(0, end)}/api/0/${path}`;
}

/**
 * Builds an API request path, confining each interpolated value to one path segment.
 *
 * `fetch` resolves dot segments during URL parsing, so a raw value in a path can
 * rewrite it above the org and project the server injected. Encoding stops separators
 * but not `.` or `..`, which survive encoding and still collapse (the URL spec treats
 * `%2e%2e` as a dot segment too), so those are rejected instead.
 *
 * Query strings go outside the template, since `URLSearchParams` has already encoded
 * them and their separators must stay literal:
 *
 * ```typescript
 * const path = apiPath`/organizations/${organizationSlug}/issues/`;
 * await this.requestJSON(`${path}?${query}`);
 * ```
 */
export function apiPath(
  strings: TemplateStringsArray,
  ...values: (string | number)[]
): string {
  return strings.reduce((acc, literal, index) => {
    if (index >= values.length) {
      return acc + literal;
    }

    const value = String(values[index]);
    const encoded = encodeApiPathSegment(value);
    if (encoded === null) {
      throw new UserInputError(
        `Invalid identifier "${value}": relative path segments are not allowed.`,
      );
    }

    return acc + literal + encoded;
  }, "");
}

/** `path` with `query` appended, or `path` alone when `query` is empty. */
export function withQuery(path: string, query: URLSearchParams): string {
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}
