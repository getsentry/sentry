import {t} from 'sentry/locale';
import type {CallRecord} from 'sentry/views/seerExplorer/types';

/**
 * Presentation for the calls a Code Mode execute made.
 *
 * Seer reports what it did — route, params, title, outcome — and nothing about how it should look.
 * How a row reads and where it points is the client's choice, and it lives in one table in
 * `links.tsx`. What is left here is the rest of the row: its outcome tick, its expanded detail, and
 * which records are worth rendering at all.
 */

/**
 * The title seer shipped for a call, or null when it shipped none.
 *
 * A fallback, not a decision: a row whose call matches a rule in `links.tsx` is labeled by that rule
 * instead. Returning null rather than the route or an operation id is deliberate — a raw identifier
 * on screen is worse than one fewer row.
 */
export function callRecordLabel(record: CallRecord): string | null {
  return record.title?.trim() || null;
}

/**
 * How one call turned out, for the tick beside its row.
 *
 * Every row carries its own: a lib call that fans out into three requests is three separate
 * outcomes, and one tick over the group cannot say which of them failed.
 */
export function callRecordStatus(
  record: CallRecord,
  settled: boolean
): 'loading' | 'success' | 'failure' {
  if (record.error || (record.status && record.status >= 400)) {
    return 'failure';
  }
  if (record.status !== undefined) {
    return 'success';
  }
  // No status and nothing settled means the request is still open — the live mirror publishes a
  // record when the call starts, not when it returns.
  //
  // Once the execute has returned there is nothing still in flight, and a status may legitimately
  // never arrive: the Explorer-backed lib calls (`code_search`, `bash`, `ask_user_question`) never
  // reach the HTTP transport, so they have no status to report and only ever set `error`. Reading
  // that as "still running" left them spinning forever.
  return settled ? 'success' : 'loading';
}

/** A call that failed, for the row's tooltip. Null when it succeeded or never reported. */
export function callRecordFailure(record: CallRecord): string | null {
  if (record.error) {
    return t('Request failed: %s', record.error);
  }
  if (record.status && record.status >= 400) {
    return t('Returned HTTP %s', record.status);
  }
  return null;
}

/**
 * The request a row stands for, for the expanded view: what ran, and with what.
 *
 * Reads `resolved_path` rather than reassembling the template, so what is shown is literally what
 * was requested. Returns null for a lib call, which has no route of its own — its children carry
 * the requests.
 */
export function callRecordDetail(record: CallRecord): {
  body: string | null;
  request: string;
} | null {
  // A lib call is a heading for the api calls nested under it, and those carry the detail. Giving
  // it its own expander would add a control that reveals less than the rows already below it.
  if (record.kind !== 'api' || !record.method) {
    return null;
  }

  const path = record.resolved_path ?? record.path;
  if (!path) {
    return null;
  }

  // Seer composes the query string into `resolved_path`, so the request line is the whole URL —
  // a list of params underneath would restate what the URL already says.
  return {
    request: `${record.method} ${path}`,
    body: withEllipsis(record.body, record.body_truncated),
  };
}

/** Mark a cut-short preview so the box does not read as the whole payload. */
function withEllipsis(
  text: string | undefined,
  truncated: boolean | undefined
): string | null {
  if (!text) {
    return null;
  }
  return truncated ? `${text}\n…` : text;
}

/**
 * Lib helpers whose own row is a better destination than the HTTP children underneath.
 *
 * Most composite libs are dropped when they fan out: the child API rows say more.
 * `get_span_details` is the exception — its only HTTP call is the trace endpoint, which can only
 * link to the trace, while the lib's own args name the span the user asked about.
 */
const PREFER_LIB_OVER_CHILDREN = new Set(['get_span_details']);

/**
 * The records worth rendering, in the order they ran.
 *
 * A lib call that fanned out into api calls is dropped: it is a heading for rows that each say
 * more than it does, and keeping it means a parent with no expander sitting above indented
 * children. A lib call with no api children is kept — the Explorer-backed helpers (`code_search`,
 * `bash`, `ask_user_question`) never touch the transport, so their own row is the only trace they
 * leave. Helpers in `PREFER_LIB_OVER_CHILDREN` keep their own row and suppress children instead.
 */
export function visibleCallRecords(records: CallRecord[]): CallRecord[] {
  const hasChildren = new Set(
    records.flatMap(record =>
      record.parent === null || record.parent === undefined ? [] : [record.parent]
    )
  );

  const hideChildrenOf = new Set(
    records
      .filter(
        record =>
          record.kind === 'lib' &&
          record.name &&
          PREFER_LIB_OVER_CHILDREN.has(record.name) &&
          hasChildren.has(record.id)
      )
      .map(record => record.id)
  );

  return records.filter(record => {
    if (
      record.parent !== null &&
      record.parent !== undefined &&
      hideChildrenOf.has(record.parent)
    ) {
      return false;
    }
    if (record.kind !== 'lib' || !hasChildren.has(record.id)) {
      return true;
    }
    return Boolean(record.name && PREFER_LIB_OVER_CHILDREN.has(record.name));
  });
}
