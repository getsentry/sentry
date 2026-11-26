/**
 * Limit-bounded, resume-safe pagination over Sentry list endpoints. Pure
 * logic with no I/O, so it runs in Node and Cloudflare Workers. Each product
 * fetches pages, validates rows, logs, and maps failures to its own errors.
 */

import { consumePage, paginateUpTo } from "@sentry/api";

/**
 * Sentry API's maximum items per page. Some endpoints silently cap larger
 * `per_page` values; others (org project list) return 400.
 */
export const API_MAX_PER_PAGE = 100;

/** One fetched page: its rows and the server's next-page cursor. */
export type Page<T> = {
  data: T;
  nextCursor?: string;
};

/**
 * A Sentry next-page cursor, `<value>:<offset>:<is_prev>`, split before
 * `is_prev`, which may carry a skip count ({@link encodeSkip}).
 */
const NEXT_CURSOR_RE = /^(.*:\d+):(0(?:_?0)*)$/;

/** Resumes at the first row for every paginator the products use. */
const FIRST_PAGE_CURSOR = "0:0:0";

/** `OffsetPaginator` cursors are `<per_page>:<page>:<is_prev>`. */
const PAGE_NUMBER_CURSOR_RE = /^(\d+):\d+:[01]$/;

/**
 * Prefix of `cli1~<perPage>~<skip>~<server cursor>` cursors, which nightly
 * CLI builds returned. Read so their saved history still resumes; never
 * written, because older CLIs send cursors to the API unchanged.
 */
const CLI_CURSOR_PREFIX = "cli1~";

/**
 * Where a {@link paginate} walk resumes: the server cursor that fetches the
 * page, the page size it must be fetched with, and how many of that page's
 * rows were already returned.
 */
export type CursorPosition = {
  /** Server cursor to request; undefined starts at the first page. */
  cursor: string | undefined;
  /** Required page size in rows, when encoded in the cursor; otherwise unspecified. */
  perPage?: number;
  /** Number of rows already returned from this position; zero starts at its first row. */
  skip: number;
};

/** Receives a message when a cursor is unreadable and the walk restarts. */
type Warn = (message: string) => void;

/**
 * Write how many rows of a page were already returned into a cursor's
 * `is_prev` field, so the cursor stays a valid Sentry cursor.
 *
 * Sentry parses `is_prev` with Python's `int()` (`Cursor.from_string` in
 * `src/sentry/utils/cursors.py`). `int()` ignores leading zeros and allows a
 * single `_` between digits (PEP 515), so any string of `0`s joined by
 * single `_`s is 0: "next page". The skip count is written in binary in that
 * alphabet: a leading `0`, then `_0` for each 1 bit and `0` for each 0 bit,
 * most significant first. 82 is `1010010`, so `0` + `_0 0 _0 0 0 _0 0`
 * gives `0_00_000_00`.
 *
 * The API and older CLIs read the cursor as the page's own cursor and return
 * the page from its first row; {@link decodeSkip} recovers the count.
 *
 * @param skip - Rows of the page already returned; must be at least 1
 */
function encodeSkip(skip: number): string {
  return `0${skip.toString(2).replaceAll("1", "_0")}`;
}

/** Read the skip count {@link encodeSkip} wrote; plain `0` is no skip. */
function decodeSkip(isPrev: string): number {
  return Number.parseInt(isPrev.slice(1).replaceAll("_0", "1"), 2) || 0;
}

/**
 * Encode where a walk resumes as a Sentry cursor. A server cursor that is not
 * a Sentry next-page cursor cannot carry the skip, so it is returned as is and
 * resuming returns that page's rows again rather than missing any.
 */
function encodePageCursor(cursor: string | undefined, skip: number): string {
  const server = cursor ?? FIRST_PAGE_CURSOR;
  const next = skip > 0 ? NEXT_CURSOR_RE.exec(server) : null;
  return next ? `${next[1]}:${encodeSkip(skip)}` : server;
}

/**
 * Decode a cursor from {@link paginate}, an older CLI, or an API response.
 *
 * A damaged `cli1~` cursor is ignored with a warning and the walk starts from
 * the first page, so it never fails a call or reaches the API.
 */
export function decodePageCursor(
  raw: string | undefined,
  warn: Warn = () => {},
): CursorPosition {
  if (!raw) {
    return { cursor: undefined, skip: 0 };
  }
  if (raw.startsWith(CLI_CURSOR_PREFIX)) {
    return decodeCliCursor(raw, warn);
  }
  const next = NEXT_CURSOR_RE.exec(raw);
  const cursor = next ? `${next[1]}:0` : raw;
  const position = {
    cursor: cursor === FIRST_PAGE_CURSOR ? undefined : cursor,
    skip: next?.[2] ? decodeSkip(next[2]) : 0,
  };
  const perPage = serverCursorPageSize(cursor);
  return perPage === undefined ? position : { ...position, perPage };
}

function decodeCliCursor(raw: string, warn: Warn): CursorPosition {
  const [perPage, skip, ...server] = raw
    .slice(CLI_CURSOR_PREFIX.length)
    .split("~");
  const position = {
    perPage: Number(perPage),
    skip: Number(skip),
    cursor: server.join("~") || undefined,
  };
  if (
    Number.isInteger(position.perPage) &&
    position.perPage >= 1 &&
    position.perPage <= API_MAX_PER_PAGE &&
    Number.isInteger(position.skip) &&
    position.skip >= 0
  ) {
    return position;
  }
  warn(
    "Ignoring an unreadable pagination cursor; starting from the first page.",
  );
  return { cursor: undefined, skip: 0 };
}

/**
 * Consume one fetched page from a decoded cursor position without making requests.
 *
 * Removes rows already delivered by a previous call. Sentry next-page cursors
 * record any unconsumed rows or remaining skip; other cursor shapes are returned
 * unchanged and may replay rows on resume.
 *
 * @param page - Server page fetched using the position's cursor and page size
 * @param position - Decoded continuation for this page
 * @param limit - Maximum rows to return, a non-negative integer; omitted means all remaining rows
 * @returns Remaining rows and continuation metadata
 */
export function consumeCursorPage<T>(
  page: Page<T[]>,
  position: CursorPosition,
  limit = Number.POSITIVE_INFINITY,
): Page<T[]> {
  const consumed = consumePage(
    { data: page.data, nextCursor: page.nextCursor || undefined },
    { cursor: position.cursor, offset: position.skip },
    limit,
  );
  return {
    ...page,
    data: consumed.data,
    nextCursor: consumed.position
      ? encodePageCursor(consumed.position.cursor, consumed.position.offset)
      : undefined,
  };
}

/**
 * Page size a server cursor must be resumed with, if it carries one.
 *
 * `OffsetPaginator` cursors are only valid with the page size that produced
 * them. Other paginators put an offset of 0 or a sort value there; a sort
 * value that happens to be in range only changes the page size, which they
 * tolerate.
 */
function serverCursorPageSize(cursor: string): number | undefined {
  const value = Number(PAGE_NUMBER_CURSOR_RE.exec(cursor)?.[1]);
  return Number.isInteger(value) && value >= 1 && value <= API_MAX_PER_PAGE
    ? value
    : undefined;
}

/**
 * Page size for a walk that starts fresh: the fewest requests that can hold
 * `limit` rows, split as evenly as possible so the last request is not a
 * full page for a few rows (201 rows → 3 pages of 67, not 100 + 100 + 100).
 */
function pageSizeForLimit(limit: number): number {
  if (limit <= API_MAX_PER_PAGE) {
    return Math.max(1, limit);
  }
  return Math.ceil(limit / Math.ceil(limit / API_MAX_PER_PAGE));
}

/** Options for {@link paginate}. */
export type PaginateOptions = {
  /** Most rows to return. */
  limit: number;
  /** Cursor to resume from: one {@link paginate} returned, or a raw server cursor. */
  cursor?: string;
  /** Most pages to fetch before stopping with a resume cursor. */
  maxPages: number;
  /** Receives a message when `cursor` is unreadable and the walk restarts. */
  warn?: Warn;
};

/** Rows from a {@link paginate} walk and where to resume. */
export type PaginateResult<T> = {
  data: T[];
  /** Resumes at the first row not returned; absent once the server is exhausted. */
  nextCursor?: string;
  /** The walk hit `maxPages` before collecting `limit` rows. */
  stoppedAtPageCap: boolean;
};

/**
 * Fetch up to `limit` rows and a cursor that resumes after the last one.
 *
 * - A fresh walk splits `limit` evenly over the fewest requests
 *   ({@link pageSizeForLimit}). Resuming a page-number cursor
 *   (`OffsetPaginator`, used by projects, teams, members, repositories, and
 *   dashboard revisions) reuses the page size the cursor encodes
 *   (`<per_page>:<page>:<is_prev>`), whatever the new `limit`: pairing it with
 *   another `per_page` reads the wrong window and silently skips rows.
 * - The returned cursor always resumes at the first row the caller has not
 *   received. When a walk stops inside a page (a smaller limit, or a server
 *   that ignored `per_page`), the cursor refetches that page and skips the
 *   rows already returned.
 *
 * Returned cursors are Sentry cursors, so older CLI versions and the API
 * accept them too; mid-page cursors record the rows to skip in `is_prev`
 * ({@link encodeSkip}), which a caller that does not know about them sees
 * again rather than misses (given the page size a page-number cursor
 * encodes). Pass cursors back through this function to resume exactly.
 *
 * Callers own region resolution and query building inside `fetchPage`, and
 * must send `perPage` as the request's `per_page` unchanged.
 *
 * @param options - Limit, start cursor, page cap, and warning sink
 * @param fetchPage - Fetches one page given the page size and a server cursor
 */
export async function paginate<T>(
  options: PaginateOptions,
  fetchPage: (
    perPage: number,
    cursor: string | undefined,
  ) => Promise<Page<T[]>>,
): Promise<PaginateResult<T>> {
  const { limit, maxPages, warn = () => {} } = options;
  const position = decodePageCursor(options.cursor, warn);
  // Keep the CLI's page sizing and legacy bookmarks while the SDK owns traversal.
  const perPage = position.perPage ?? pageSizeForLimit(limit + position.skip);
  const result = await paginateUpTo(
    async (cursor) => {
      const page = await fetchPage(perPage, cursor);
      return { data: page.data, nextCursor: page.nextCursor || undefined };
    },
    {
      limit,
      maxPages,
      resume: {
        cursor: position.cursor,
        offset: position.skip,
        requestBudget: limit + position.skip,
      },
    },
    "paginate",
  );
  return {
    data: result.data,
    ...(result.continuation
      ? {
          nextCursor: encodePageCursor(
            result.continuation.cursor,
            result.continuation.offset,
          ),
        }
      : {}),
    stoppedAtPageCap: result.stopReason === "maxPages",
  };
}

/** Why {@link fetchAllPages} could not return every row. */
export type FetchAllPagesFailure =
  | "invalid-page"
  | "repeated-cursor"
  | "page-cap";

/** Every row from {@link fetchAllPages}, or why the walk stopped. */
export type FetchAllPagesResult<T> =
  | { ok: true; items: T[] }
  | { ok: false; reason: FetchAllPagesFailure };

/**
 * Fetch and validate every page of a list endpoint, or report why not.
 *
 * A partial result is a failure: use this when a missing page could hide the
 * record a mutation depends on. Fails on an invalid page, a repeated cursor,
 * or more than `maxPages` pages.
 *
 * @param fetchPage - Fetches one page given a cursor
 * @param parse - Returns a page's validated rows, or `undefined` when invalid
 * @param maxPages - Most pages to fetch
 */
export async function fetchAllPages<T>(
  fetchPage: (cursor: string | undefined) => Promise<Page<unknown>>,
  parse: (data: unknown) => T[] | undefined,
  maxPages: number,
): Promise<FetchAllPagesResult<T>> {
  const items: T[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const { data, nextCursor } = await fetchPage(cursor);
    const rows = parse(data);
    if (!rows) {
      return { ok: false, reason: "invalid-page" };
    }
    items.push(...rows);
    if (!nextCursor) {
      return { ok: true, items };
    }
    if (seen.has(nextCursor)) {
      return { ok: false, reason: "repeated-cursor" };
    }
    seen.add(nextCursor);
    cursor = nextCursor;
  }
  return { ok: false, reason: "page-cap" };
}
