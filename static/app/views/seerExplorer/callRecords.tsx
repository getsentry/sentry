import type {LocationDescriptor} from 'history';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import type {CallRecord} from 'sentry/views/seerExplorer/types';
import {buildToolLinkUrl} from 'sentry/views/seerExplorer/utils';

/**
 * Presentation for the calls a Code Mode execute made.
 *
 * Seer reports what it did — route, params, title, outcome — and nothing about how it should look.
 * Everything here is the client's choice: which calls are worth a link, what they're labeled, and
 * whether a route gets bespoke treatment. Adding a handler is a frontend-only deploy.
 */

/**
 * Path params that identify something a user can navigate to, mapped to the link kind whose URL
 * builder knows how to reach it.
 *
 * Deliberately small. Path params concentrate hard across the ~790 routes seer exposes —
 * `organization_id_or_slug` and `project_id_or_slug` appear in most of them but are scope, not
 * destinations. These are the ones that name a resource with a page. Order matters: the first
 * match wins, so more specific pairings (an event inside an issue) come before their parts.
 */
const NAVIGABLE_PARAMS: Array<{kind: string; params: readonly string[]}> = [
  {kind: 'get_event_details', params: ['issue_id', 'event_id']},
  {kind: 'get_issue_details', params: ['issue_id']},
  // span_id alone is not a page; it deep-links into the trace waterfall.
  {kind: 'get_trace_waterfall', params: ['trace_id', 'span_id']},
  {kind: 'get_trace_waterfall', params: ['trace_id']},
  {kind: 'get_replay_details', params: ['replay_id']},
];

/**
 * Lib helpers whose own row is a better destination than the HTTP children underneath.
 *
 * Most composite libs are dropped when they fan out: the child API rows say more. `get_span_details`
 * is the exception — its only HTTP call is the trace endpoint, which can only link to the trace,
 * while the lib's own args name the span the user actually asked about.
 */
const PREFER_LIB_OVER_CHILDREN = new Set(['get_span_details']);

/**
 * Param values that name a resource to the API but not to the UI.
 *
 * The Sentry API resolves these server-side — `GET /issues/54/events/latest/` returns the newest
 * event — but the corresponding UI route expects a concrete id, so linking one produces a dead
 * page. Any param carrying one of these is treated as non-identifying, which falls the record back
 * to a coarser link (the issue rather than the event) instead of a broken one.
 */
const API_ONLY_ALIASES = new Set(['latest', 'oldest', 'recommended', 'me']);

function identifies(value: string | undefined): value is string {
  return Boolean(value) && !API_ONLY_ALIASES.has(value!);
}

/**
 * A record's destination, or null when it identifies nothing navigable.
 *
 * Built here rather than in seer: `buildToolLinkUrl` already encodes every Sentry URL shape for the
 * classic tool path, and duplicating that knowledge server-side would mean maintaining Sentry's
 * routing against an OpenAPI spec that says nothing about it.
 */
export function callRecordLink(
  record: CallRecord,
  organization: Organization,
  projects?: Array<{id: string; slug: string}>
): {kind: string; url: LocationDescriptor} | null {
  const rawParams = recordParams(record);
  if (!rawParams) {
    return null;
  }

  // API rows only link when the route ends at the resource; lib rows have no route, so their
  // scalar args are the whole identity (e.g. get_span_details(trace_id, span_id)).
  if (record.kind === 'api' && !addressesItsOwnResource(record)) {
    return null;
  }

  // Drop alias-valued params up front rather than per-match. The URL builders read params beyond
  // the ones a match keys on — `get_issue_details` also consults `event_id` — so an alias left in
  // the bag would still reach a builder and produce the dead link we are avoiding.
  const pathParams = Object.fromEntries(
    Object.entries(rawParams).filter(([, value]) => identifies(value))
  );

  for (const {kind, params} of NAVIGABLE_PARAMS) {
    if (params.every(name => pathParams[name])) {
      const url = buildToolLinkUrl({kind, params: pathParams}, organization, projects);
      if (url) {
        return {kind, url: scopeToOrganization(url, organization)};
      }
    }
  }
  return null;
}

/** Path params for an API call, or the scalar args that play the same role for a lib call. */
function recordParams(record: CallRecord): Record<string, string> | undefined {
  if (record.path_params) {
    return record.path_params;
  }
  if (record.kind === 'lib' && record.params) {
    return record.params;
  }
  return undefined;
}

/**
 * Whether the route's own subject is the resource we would link to.
 *
 * Without this, every route containing `{issue_id}` links to the issue page — so fetching an
 * issue, its latest event, and its tags produces three rows pointing at the same place, which
 * tells the reader nothing and makes the links look arbitrary. A route only earns a link when it
 * *ends* at the thing being linked; `/issues/{issue_id}/tags/` is about tags, and there is no tags
 * page to send anyone to, so it gets none.
 */
function addressesItsOwnResource(record: CallRecord): boolean {
  const path = record.path?.replace(/\/$/, '');
  return Boolean(path?.endsWith('}'));
}

/**
 * Qualify an org-less path with the organization, then normalize.
 *
 * `buildToolLinkUrl` is inconsistent about this: some cases return
 * `/organizations/{slug}/traces/`, others a bare `/issues/54/`. The bare form only resolves under
 * a customer domain, so it 404s on a plain dev host. Emitting the qualified path and running it
 * through `normalizeUrl` is correct in both worlds — normalizeUrl strips the prefix back off when
 * a customer domain is in play.
 */
function scopeToOrganization(
  url: LocationDescriptor,
  organization: Organization
): LocationDescriptor {
  const prefix = `/organizations/${organization.slug}`;

  if (typeof url === 'string') {
    return normalizeUrl(url.startsWith('/organizations/') ? url : `${prefix}${url}`);
  }
  if (!url.pathname || url.pathname.startsWith('/organizations/')) {
    return normalizeUrl(url);
  }
  return normalizeUrl({...url, pathname: `${prefix}${url.pathname}`});
}

/**
 * Bespoke rendering for a specific route or lib method.
 *
 * Keyed `"<METHOD> <templated path>"` for API records and by method name for lib records — the
 * same keys seer reports, so a handler is registered without seer knowing it exists. A route with
 * no handler falls back to the title seer shipped, which is why the map can stay small: it holds
 * only the calls worth saying something better about than their spec name.
 */
type CallHandler = (record: CallRecord, settled: boolean) => string | null;

const CALL_HANDLERS: Record<string, CallHandler> = {
  'PUT /api/0/organizations/{organization_id_or_slug}/issues/': record =>
    record.status && record.status < 300 ? t('Updated issues') : t('Update issues'),
  code_search: () => t('Searched code'),
  git_search: () => t('Searched commit history'),
  bash: () => t('Ran a command'),
  ask_user_question: () => t('Asked a question'),
  review_code_changes: () => t('Reviewed code changes'),
  telemetry_live_search: (record, settled) => telemetryLiveSearchLabel(record, settled),
};

const TELEMETRY_DATASET_NOUN: Record<string, string> = {
  spans: 'spans',
  errors: 'errors',
  logs: 'logs',
  metrics: 'metrics',
  tracemetrics: 'metrics',
  issues: 'issues',
};

/** Dataset-specific copy for `telemetry_live_search`, matching the classic tool formatter. */
function telemetryLiveSearchLabel(record: CallRecord, settled: boolean): string {
  const dataset = record.params?.dataset;
  const noun = (dataset && TELEMETRY_DATASET_NOUN[dataset]) || 'telemetry';
  // Explorer-backed libs never set HTTP status, so tense follows whether the execute has returned.
  return settled ? t('Queried %s', noun) : t('Querying %s', noun);
}

function handlerKey(record: CallRecord): string | null {
  if (record.kind === 'lib') {
    return record.name ?? null;
  }
  return record.method && record.path ? `${record.method} ${record.path}` : null;
}

/**
 * What to show for a call, or null when we have nothing worth showing.
 *
 * Returning null rather than falling back to the route or an operation id is deliberate: a raw
 * identifier on screen is worse than one fewer row.
 */
export function callRecordLabel(
  record: CallRecord,
  /**
   * Whether the parent execute has finished. Handlers that conjugate on tense (telemetry) need this
   * because Explorer-backed libs never carry an HTTP status of their own.
   */
  settled = true
): string | null {
  const key = handlerKey(record);
  const handler = key ? CALL_HANDLERS[key] : undefined;
  if (handler) {
    const label = handler(record, settled);
    if (label) {
      return label;
    }
  }
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
 * The records worth rendering, in the order they ran.
 *
 * A lib call that fanned out into api calls is dropped: it is a heading for rows that each say
 * more than it does, and keeping it means a parent with no expander sitting above indented
 * children. A lib call with no api children is kept — the Explorer-backed helpers (`code_search`,
 * `bash`, `ask_user_question`) never touch the transport, so their own row is the only trace they
 * leave.
 */
export function visibleCallRecords(records: CallRecord[]): CallRecord[] {
  const hasChildren = new Set(
    records.flatMap(record =>
      record.parent === null || record.parent === undefined ? [] : [record.parent]
    )
  );

  // Lib helpers in PREFER_LIB_OVER_CHILDREN keep their own row and suppress children; every other
  // parent-with-children lib is dropped so the more specific API rows remain.
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
