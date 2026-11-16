/**
 * Sentry API pagination utilities.
 *
 * Sentry uses cursor-based pagination via HTTP Link headers.
 * These helpers make it ergonomic to paginate through results
 * returned by the generated SDK functions.
 */

import type { SdkResult } from "./sentry-errors";

export type UnwrappedResult<TData> = {
  data: TData;
  response: Response;
};

export type PaginatedResponse<T> = {
  data: T;
  /** The HTTP response for this page, including headers. Its body is already read. */
  response: Response;
  /** Cursor for the next page. `undefined` when there are no more pages. */
  nextCursor?: string;
  /** Cursor for the previous page. `undefined` on the first page. */
  prevCursor?: string;
};

/** A position within a page fetched with an opaque server cursor. */
export type PagePosition = {
  readonly cursor?: string;
  /** Rows already consumed, before applying the next item budget. */
  readonly offset: number;
};

/**
 * Serializable continuation returned by `paginateUpTo`.
 * Keep the same operation, query and fetcher configuration when resuming.
 * Partial pages retain the fetcher's original request budget for exact replay;
 * page boundaries use the next call's budget instead.
 */
export type PaginationContinuation = PagePosition & (
  | { readonly offset: 0; readonly requestBudget?: never }
  | { readonly requestBudget: number }
);

/** Aggregate data has no single HTTP response. Only `exhausted` means complete. */
export type PaginatedCollection<TItem> = {
  data: Array<TItem>;
  stopReason: "exhausted" | "limit" | "maxPages";
  /** Omitted when exhausted or when trimming a page makes continuation unsafe. */
  nextCursor?: string;
  /** `paginateUpTo` can resume here, including within a partially consumed page. */
  continuation?: PaginationContinuation;
};

export type PaginateAllOptions = {
  /** Hard cap on the number of pages fetched. Default: 50. */
  maxPages?: number;
  /** Resume from a previous nextCursor, keeping the same filters and page size. */
  startCursor?: string;
};

export type PaginateUpToOptions = {
  /** Hard cap on the number of items returned. Required. */
  limit: number;
  /** Safety cap on the number of pages fetched. Default: 50. */
  maxPages?: number;
  /** Resume forward traversal from a previous nextCursor, keeping the same query. */
  startCursor?: string;
  /** Resume a batch, including pending rows in its last page. Cannot combine with startCursor. */
  resume?: PaginationContinuation;
  /** Called after each page is fetched. Useful for progress indicators. */
  onPage?: (fetched: number, limit: number) => void;
};

export type PageFetcher<TData, TError> = (
  cursor: string | undefined,
) => Promise<SdkResult<TData, TError>>;

/**
 * The request budget lets a custom fetcher reduce its HTTP page size.
 * Normally the remaining item budget; replaying a partial page repeats the
 * original value even when the new batch has a different limit.
 */
export type BudgetedPageFetcher<TData, TError> = (
  cursor: string | undefined,
  requestBudget: number,
) => Promise<SdkResult<TData, TError>>;

/** A page whose consumer already handled the HTTP response and any errors. */
export type CollectionPage<TItem> = {
  data: Array<TItem>;
  nextCursor?: string;
  /** Reserved for SDK operation envelopes; normalized fetchers reject on failure. */
  request?: never;
  error?: never;
};

/** Compose an existing page fetcher with bounded collection, without HTTP objects. */
export type CollectionPageFetcher<TItem> = (
  cursor: string | undefined,
  requestBudget: number,
) => Promise<CollectionPage<TItem>>;

function assertPositiveInteger(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive safe integer, got ${value}`);
  }
}

function assertPagePosition(position: PagePosition): void {
  if (!Number.isSafeInteger(position.offset) || position.offset < 0) {
    throw new Error(`pagination: offset must be a non-negative safe integer, got ${position.offset}`);
  }
  if (position.cursor !== undefined && typeof position.cursor !== "string") {
    throw new Error("pagination: cursor must be a string");
  }
}

/**
 * Consume rows from an already fetched page without fetching or interpreting cursors.
 * Returns a position for the next consumption, or none when the page is fully
 * consumed and the server advertises no next page. The caller retains the
 * original response, headers and envelope; neither input is mutated.
 *
 * A position inside the current page requires fetching that page again with
 * the same request options. An offset beyond a short page carries forward to
 * its successor. Like server pagination, this does not snapshot changing data.
 */
export function consumePage<T>(
  page: Pick<PaginatedResponse<Array<T>>, "data" | "nextCursor">,
  position: PagePosition,
  limit = Number.POSITIVE_INFINITY,
): { data: Array<T>; position?: PagePosition } {
  assertPagePosition(position);
  if (limit !== Number.POSITIVE_INFINITY && (!Number.isSafeInteger(limit) || limit < 0)) {
    throw new Error(`consumePage: limit must be a non-negative safe integer, got ${limit}`);
  }
  const end = Math.min(page.data.length, position.offset + limit);
  const data = page.data.slice(position.offset, end);
  if (end < page.data.length) {
    return { data, position: { ...position, offset: end } };
  }
  if (page.nextCursor !== undefined) {
    return {
      data,
      position: { cursor: page.nextCursor, offset: Math.max(0, position.offset - page.data.length) },
    };
  }
  return { data };
}

/**
 * Parse Sentry's Link header to extract pagination cursors.
 *
 * Sentry returns Link headers in the format:
 *   <url>; rel="previous"; results="true"; cursor="abc:0:1";,
 *   <url>; rel="next"; results="true"; cursor="1234:0:0";
 *
 * Returns `{ nextCursor?, prevCursor? }`:
 *   - `nextCursor` set when there is a next page.
 *   - `prevCursor` set when there is a previous page.
 *
 * The `results="true"` qualifier is required — Sentry includes a
 * `previous` rel even on the first page, but with `results="false"`.
 * We honor that signal so first-page callers don't see a bogus `prevCursor`.
 */
export const parseSentryLinkHeader = (
  header: string | null,
): { nextCursor?: string; prevCursor?: string } => {
  if (!header) {
    return {};
  }

  const segments = header.split(",");

  let nextCursor: string | undefined;
  let prevCursor: string | undefined;

  for (const segment of segments) {
    const parts = segment.trim().split(";").map((s) => s.trim());

    let rel: string | undefined;
    let results: string | undefined;
    let cursor: string | undefined;

    for (const part of parts) {
      const relMatch = part.match(/^rel="([^"]*)"$/);
      if (relMatch) {
        rel = relMatch[1];
        continue;
      }
      const resultsMatch = part.match(/^results="([^"]*)"$/);
      if (resultsMatch) {
        results = resultsMatch[1];
        continue;
      }
      const cursorMatch = part.match(/^cursor="([^"]*)"$/);
      if (cursorMatch) {
        cursor = cursorMatch[1];
        continue;
      }
    }

    if (results !== "true" || !cursor) {
      continue;
    }
    if (rel === "next") {
      nextCursor = cursor;
    } else if (rel === "previous") {
      prevCursor = cursor;
    }
  }

  const out: { nextCursor?: string; prevCursor?: string } = {};
  if (nextCursor !== undefined) out.nextCursor = nextCursor;
  if (prevCursor !== undefined) out.prevCursor = prevCursor;
  return out;
};

/**
 * Internal: merge a managed cursor and verified page-size budget into `options.query`
 * and re-shape the result back to the SDK's `Options<TData>` type.
 *
 * Used exclusively by the auto-generated wrappers in `pagination.gen.ts`
 * (one call per wrapper kind, one `_withCursor` invocation per page).
 * Centralizes the cast chain — every wrapper used to inline its own
 * `as unknown as ...` quartet, which meant the same logic was repeated
 * once per generated wrapper (~115 places). This helper makes that
 * exactly one place.
 *
 * Type-erasure rationale: each SDK operation has its own `Options<TData>`
 * shape with operation-specific `query`, `path`, and `body` types. We
 * can't write a generic that's tight enough to satisfy all 200+ SDK
 * functions structurally without committing to a discriminated-union
 * encoding of every operation. The `_` prefix marks this as internal —
 * the typed wrappers in `pagination.gen.ts` are the supported public API.
 *
 * @internal
 */
export const _withCursor = <TOptions>(
  options: { query?: unknown; [k: string]: unknown },
  cursor: string | undefined,
  pageSize?: { parameter: "per_page" | "limit"; max: number; remaining: number },
): TOptions => {
  const query = options.query as Record<string, unknown> | undefined;
  let size: number | undefined;
  if (pageSize !== undefined) {
    const requested = query?.[pageSize.parameter] ?? pageSize.max;
    assertPositiveInteger(requested, `pagination: ${pageSize.parameter}`);
    size = Math.min(requested, pageSize.max, pageSize.remaining);
  }
  if (query === undefined && cursor === undefined && pageSize === undefined) {
    return options as unknown as TOptions;
  }
  return {
    ...options,
    query: {
      ...query,
      ...(cursor !== undefined ? { cursor } : undefined),
      ...(pageSize !== undefined ? { [pageSize.parameter]: size } : undefined),
    },
  } as unknown as TOptions;
};

/**
 * Unwrap an SDK result, throwing on error.
 *
 * Returns `{ data, response }` so callers retain access to the
 * raw Response (and its headers) for pagination or other needs.
 *
 * Throws the exact error supplied by the operation, including custom mapped
 * errors and failures without an HTTP response. The SDK normalizes default
 * HTTP errors before this helper runs.
 *
 * The context argument remains accepted for compatibility. It no longer
 * changes error messages or wraps errors.
 */
export const unwrapResult = <TData, TError = unknown>(
  result: SdkResult<TData, TError>,
  _context: string,
): UnwrappedResult<TData> => {
  if ("error" in result) {
    throw result.error;
  }
  return {
    data: result.data,
    response: result.response,
  };
};

/**
 * Unwrap an SDK result and extract pagination cursors from the
 * Link header. Throws on error.
 *
 * Returns `{ data, response, nextCursor?, prevCursor? }`. Each cursor is
 * `undefined` when the corresponding rel does not exist or has
 * `results="false"`.
 */
export const unwrapPaginatedResult = <TData>(
  result: SdkResult<TData>,
  context: string,
): PaginatedResponse<TData> => {
  const { data, response } = unwrapResult(result, context);
  const linkHeader = response.headers.get("link");
  const { nextCursor, prevCursor } = parseSentryLinkHeader(linkHeader);
  const out: PaginatedResponse<TData> = { data, response };
  if (nextCursor !== undefined) out.nextCursor = nextCursor;
  if (prevCursor !== undefined) out.prevCursor = prevCursor;
  return out;
};

/**
 * Fetch a single page from a Sentry list endpoint and return both
 * the data and the pagination cursors.
 *
 * Thin wrapper over an SDK function call: invokes the fetcher with
 * an optional cursor, unwraps the result, and parses the Link header.
 *
 * Useful when you want manual control over pagination (e.g. exposing
 * a "next page" button in a UI) instead of fetching all pages eagerly.
 *
 * @example
 * ```ts
 * const { data, nextCursor } = await fetchPage(
 *   (cursor) => listAnOrganization_sRepositories({
 *     path: { organization_id_or_slug: 'my-org' },
 *     query: { cursor },
 *   }),
 *   'listRepos',
 * );
 * ```
 */
export const fetchPage = async <TData, TError = unknown>(
  fetcher: PageFetcher<TData, TError>,
  context: string,
  cursor?: string,
): Promise<PaginatedResponse<TData>> => {
  const result = await fetcher(cursor);
  return unwrapPaginatedResult(result, context);
};

/**
 * Collect pages until the collection is exhausted or `maxPages` is reached.
 * A request cap returns `stopReason: "maxPages"` and a safe resume cursor.
 */
export const paginateAll = async <TItem, TError = unknown>(
  fetcher: PageFetcher<Array<TItem>, TError>,
  context: string,
  options?: PaginateAllOptions,
): Promise<PaginatedCollection<TItem>> => {
  const maxPages = options?.maxPages ?? 50;
  assertPositiveInteger(maxPages, "paginateAll: maxPages");
  const allItems: Array<TItem> = [];
  let cursor = options?.startCursor;

  for (let page = 0; page < maxPages; page++) {
    const result = await fetcher(cursor);
    const { data, nextCursor } = unwrapPaginatedResult(result, context);
    allItems.push(...data);

    if (nextCursor === undefined) {
      return { data: allItems, stopReason: "exhausted" };
    }
    cursor = nextCursor;
  }

  return { data: allItems, stopReason: "maxPages", nextCursor: cursor };
};

/**
 * Collect up to `limit` items, passing a request budget to the fetcher.
 * Generated wrappers use it to reduce supported HTTP page sizes. A partial
 * continuation replays the original request budget before skipping consumed rows.
 *
 * If a server still returns more items than fit, trim the page and omit its
 * server cursor: resuming past discarded items would skip records. The separate
 * continuation preserves the pending rows, even if the server has no further pages.
 */
export const paginateUpTo = async <TItem, TError = unknown>(
  fetcher: BudgetedPageFetcher<Array<TItem>, TError> | CollectionPageFetcher<TItem>,
  options: PaginateUpToOptions,
  context: string,
): Promise<PaginatedCollection<TItem>> => {
  assertPositiveInteger(options.limit, "paginateUpTo: limit");
  const maxPages = options.maxPages ?? 50;
  assertPositiveInteger(maxPages, "paginateUpTo: maxPages");
  if (options.resume !== undefined && options.startCursor !== undefined) {
    throw new Error("paginateUpTo: use either resume or startCursor, not both");
  }
  if (options.resume !== undefined) {
    assertPagePosition(options.resume);
    if (options.resume.offset > 0 || options.resume.requestBudget !== undefined) {
      assertPositiveInteger(options.resume.requestBudget, "paginateUpTo: resume.requestBudget");
    }
  }
  const allItems: Array<TItem> = [];
  let position: PagePosition = options.resume ?? { cursor: options.startCursor, offset: 0 };
  let replayBudget = options.resume?.offset ? options.resume.requestBudget : undefined;
  let continuation: PaginationContinuation | undefined;

  for (let page = 0; page < maxPages; page++) {
    const remaining = options.limit - allItems.length;
    const requestBudget = replayBudget ?? remaining;
    const result = await fetcher(position.cursor, requestBudget);
    // SDK results carry a Request; normalized pages already own their metadata.
    const { data, nextCursor } = result.request !== undefined
      ? unwrapPaginatedResult(result, context)
      : result;
    const consumed = consumePage({ data, nextCursor }, position, remaining);
    allItems.push(...consumed.data);
    options.onPage?.(allItems.length, options.limit);

    if (consumed.position === undefined) {
      return { data: allItems, stopReason: "exhausted" };
    }
    position = consumed.position;
    continuation = position.offset === 0
      ? { ...position, offset: 0 }
      : { ...position, requestBudget };
    if (allItems.length === options.limit) {
      return {
        data: allItems,
        stopReason: "limit",
        ...(position.offset === 0 && position.cursor !== undefined ? { nextCursor: position.cursor } : {}),
        continuation,
      };
    }
    replayBudget = position.offset > 0 ? requestBudget : undefined;
  }

  return {
    data: allItems,
    stopReason: "maxPages",
    ...(position.offset === 0 && position.cursor !== undefined ? { nextCursor: position.cursor } : {}),
    continuation,
  };
};
