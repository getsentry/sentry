import {parseSearch, Token} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
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
 * What a row reads as: the agent's own line when it wrote one, seer's title otherwise.
 *
 * The title is not discarded — `callRecordDetail` keeps what ran, so the line stays checkable.
 * A row matching a rule in `links.tsx` is labeled by that rule instead.
 */
export function callRecordLabel(record: CallRecord): string | null {
  return record.llm_description?.trim() || record.title?.trim() || null;
}

/**
 * A readable stand-in for a record nothing could name — generic, because a route or an operation
 * id reads worse. Reported rather than dropped: a vanishing record is how an endpoint disappears.
 */
export function fallbackCallLabel(record: CallRecord): string {
  // A noun, not a progressive verb: the row may well have settled, and a lib method that reached
  // here has no title at all — `Working…` would leave it reading as still running forever.
  return record.kind === 'api' ? t('Sentry API request') : t('Sentry operation');
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
  // Built before any fallback: the literal URL beats a generated sentence as the account of
  // what ran, which is what a described row needs to stay checkable.
  if (record.kind === 'api' && record.method) {
    const path = record.resolved_path ?? record.path;
    if (path) {
      // Seer composes the query string into `resolved_path`, so the request line is the whole URL —
      // a list of params underneath would restate what the URL already says.
      return {
        request: `${record.method} ${path}`,
        body: withEllipsis(record.body, record.body_truncated),
      };
    }
    return null;
  }

  // Nothing else ran a request of its own, so a described row falls back to the generated title
  // — without it the description would be an unfalsifiable claim.
  const described = record.llm_description?.trim();
  const title = record.title?.trim();
  if (described && title && described !== title) {
    return {request: title, body: null};
  }
  return null;
}

// Query params that scope or format a request rather than describe what it looked for. Decomposing
// these into chips would bury the meaningful filters (dataset, project, the search itself) under
// pagination and field-selection noise, so they are dropped.
const NON_FILTER_PARAMS = new Set([
  'referrer',
  'per_page',
  'cursor',
  'sort',
  'field',
  'useRpc',
  'sampling',
  'noPagination',
  'partial',
  'utc',
]);

/**
 * A filter key's specificity, for ordering the `Input:` chips from broadest scope to narrowest
 * identifier. An id (`trace_id`, `ai_conversation.id`) pins one record; a namespaced attribute
 * (`span.description`) narrows within a dataset; a plain key (`dataset`, `project`) scopes broadly.
 * Higher sorts later.
 */
function keySpecificity(key: string): number {
  if (key === 'id' || key.endsWith('.id') || key.endsWith('_id')) {
    return 3;
  }
  return key.includes('.') ? 2 : 1;
}

// Wrap a value that would otherwise re-tokenize wrong (spaces, quotes, parens) so the assembled
// query parses back to the same filter.
function quoteValue(value: string): string {
  return /[\s"()]/.test(value)
    ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    : value;
}

/**
 * Reorder a flat query into canonical least→most specific order.
 *
 * Only safe for a flat conjunction: boolean/parenthesized grouping makes order meaningful, so a
 * grouped query is returned untouched. Otherwise each term is sorted by its key's specificity
 * (ties broken by text) so the same request always reads the same way regardless of the order the
 * params happened to arrive in.
 */
function canonicalizeQuery(query: string): string {
  const parsed = parseSearch(query);
  if (!parsed) {
    return query;
  }

  // Anything beyond flat filters and whitespace — a logic group `(a OR b)`, a bare boolean, a
  // stray paren — makes token order meaningful, so the query is left exactly as written.
  const hasGrouping = parsed.some(
    token =>
      token.type !== Token.FILTER &&
      token.type !== Token.FREE_TEXT &&
      token.type !== Token.SPACES
  );
  if (hasGrouping) {
    return query;
  }

  const terms = parsed.flatMap(token => {
    if (token.type === Token.FILTER) {
      return [
        {text: token.text.trim(), specificity: keySpecificity(getKeyName(token.key))},
      ];
    }
    // Free text has no key to rank, so it sorts first (least specific).
    if (token.type === Token.FREE_TEXT && token.text.trim()) {
      return [{text: token.text.trim(), specificity: 0}];
    }
    return [];
  });

  terms.sort((a, b) => a.specificity - b.specificity || a.text.localeCompare(b.text));
  return terms.map(term => term.text).join(' ');
}

/**
 * The call's request as a single canonical query string for the `Input:` row, or null when there
 * is nothing to show.
 *
 * Reads the query string off `resolved_path` (the literal URL requested): each meaningful param
 * becomes a `key:value` term and a Sentry `query` param is folded in as its own filters, then the
 * whole thing is canonicalized (see `canonicalizeQuery`). The Explorer hands the result to
 * `FormattedQuery`, which parses grouping and renders the chips — so this only has to assemble and
 * order the terms. Scope/format params are dropped (`NON_FILTER_PARAMS`).
 */
export function callRecordInputQuery(record: CallRecord): string | null {
  const path = record.resolved_path ?? record.path;
  const queryIndex = path?.indexOf('?') ?? -1;
  if (!path || queryIndex === -1) {
    return null;
  }

  const params = new URLSearchParams(path.slice(queryIndex + 1));
  const terms: string[] = [];
  let search = '';
  for (const [key, value] of params) {
    if (!value || NON_FILTER_PARAMS.has(key)) {
      continue;
    }
    if (key === 'query') {
      search = value;
      continue;
    }
    terms.push(`${key}:${quoteValue(value)}`);
  }

  const raw = [...terms, search].filter(Boolean).join(' ').trim();
  return raw ? canonicalizeQuery(raw) : null;
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
 *
 * A described parent inverts that premise — the heading now says what none of the requests
 * underneath can — so it is kept and its children hidden. The description is what earns the row.
 */
export function visibleCallRecords(records: CallRecord[]): CallRecord[] {
  const hasChildren = new Set(
    records.flatMap(record =>
      record.parent === null || record.parent === undefined ? [] : [record.parent]
    )
  );

  const prefersOwnRow = (record: CallRecord): boolean =>
    Boolean(record.llm_description?.trim()) ||
    Boolean(record.name && PREFER_LIB_OVER_CHILDREN.has(record.name));

  const hideChildrenOf = new Set(
    records
      .filter(
        record =>
          record.kind === 'lib' && prefersOwnRow(record) && hasChildren.has(record.id)
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
    return prefersOwnRow(record);
  });
}
