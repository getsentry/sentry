/**
 * Matching for the writes Sentry declares safe to replay, for the transport's
 * `isIdempotent`. `@sentry/api` marks them `idempotent` from Sentry's
 * `x-sentry-idempotent` OpenAPI extension, so no product hard-codes which
 * writes may retry. Each product chooses how it loads the catalog: the CLI
 * extracts the list at build time to keep startup fast, and MCP reads
 * `@sentry/api/operations` directly.
 */

import { API_BASE_PATH } from "../api-base-path.gen.js";
import { isIdempotentRequest } from "./retry.js";

/** A non-safe operation Sentry marks idempotent. */
export type IdempotentOperation = {
  /** Uppercase HTTP method */
  method: string;
  /** OpenAPI path template relative to {@link API_BASE_PATH}, such as `/organizations/{org}/chunk-upload/` */
  path: string;
};

/**
 * The writes in a catalog that Sentry marks idempotent, sorted by path then
 * method. Safe methods already retry, so they are left out to keep the list
 * every request checks small.
 */
export function selectIdempotentWrites(
  operations: readonly {
    method: string;
    path: string;
    idempotent: boolean;
  }[],
): IdempotentOperation[] {
  return operations
    .filter((op) => op.idempotent && !isIdempotentRequest(op.method))
    .map((op) => ({ method: op.method, path: op.path }))
    .sort(
      (a, b) =>
        a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
    );
}

type Matcher = { method: string; pattern: RegExp };

const TEMPLATE_SEGMENT = /^\{[^/]+\}$/;
const REGEXP_SPECIAL = /[.*+?^${}()|[\]\\]/g;

function toMatcher({ method, path }: IdempotentOperation): Matcher {
  const source = path
    .split("/")
    .map((segment) =>
      TEMPLATE_SEGMENT.test(segment)
        ? "[^/]+"
        : segment.replace(REGEXP_SPECIAL, "\\$&"),
    )
    .join("/");
  return { method: method.toUpperCase(), pattern: new RegExp(`^${source}$`) };
}

/**
 * Build `isIdempotent(method, url)` for a list of writes. The list is read on
 * the first call, so a caller may pass a thunk that loads it lazily.
 *
 * Matches the path after {@link API_BASE_PATH}, so a self-hosted install
 * served under a path prefix still matches.
 */
export function createIdempotentOperationMatcher(
  operations: () => readonly IdempotentOperation[],
): (method: string, url: string) => boolean {
  let matchers: Matcher[] | undefined;
  return (method, url) => {
    if (!URL.canParse(url)) {
      return false;
    }
    const pathname = new URL(url).pathname;
    const apiIndex = pathname.indexOf(`${API_BASE_PATH}/`);
    if (apiIndex === -1) {
      return false;
    }
    const apiPath = pathname.slice(apiIndex + API_BASE_PATH.length);
    const normalized = apiPath.endsWith("/") ? apiPath : `${apiPath}/`;
    const upper = method.toUpperCase();

    matchers ??= operations().map(toMatcher);
    return matchers.some(
      (matcher) => matcher.method === upper && matcher.pattern.test(normalized),
    );
  };
}
