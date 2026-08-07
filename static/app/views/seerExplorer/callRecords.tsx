import type {LocationDescriptor} from 'history';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
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
  {kind: 'get_trace_waterfall', params: ['trace_id']},
  {kind: 'get_replay_details', params: ['replay_id']},
];

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
export function callRecordUrl(
  record: CallRecord,
  organization: Organization,
  projects?: Array<{id: string; slug: string}>
): LocationDescriptor | null {
  if (!record.path_params) {
    return null;
  }

  // Drop alias-valued params up front rather than per-match. The URL builders read params beyond
  // the ones a match keys on — `get_issue_details` also consults `event_id` — so an alias left in
  // the bag would still reach a builder and produce the dead link we are avoiding.
  const pathParams = Object.fromEntries(
    Object.entries(record.path_params).filter(([, value]) => identifies(value))
  );

  for (const {kind, params} of NAVIGABLE_PARAMS) {
    if (params.every(name => pathParams[name])) {
      const url = buildToolLinkUrl({kind, params: pathParams}, organization, projects);
      if (url) {
        return url;
      }
    }
  }
  return null;
}

/**
 * Bespoke rendering for a specific route or lib method.
 *
 * Keyed `"<METHOD> <templated path>"` for API records and by method name for lib records — the
 * same keys seer reports, so a handler is registered without seer knowing it exists. A route with
 * no handler falls back to the title seer shipped, which is why the map can stay small: it holds
 * only the calls worth saying something better about than their spec name.
 */
const CALL_HANDLERS: Record<string, (record: CallRecord) => string | null> = {
  'PUT /api/0/organizations/{organization_id_or_slug}/issues/': record =>
    record.status && record.status < 300 ? t('Updated issues') : t('Update issues'),
  code_search: () => t('Searched code'),
  git_search: () => t('Searched commit history'),
  bash: () => t('Ran a command'),
  ask_user_question: () => t('Asked a question'),
  review_code_changes: () => t('Reviewed code changes'),
  telemetry_live_search: () => t('Queried telemetry'),
};

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
export function callRecordLabel(record: CallRecord): string | null {
  const key = handlerKey(record);
  const handler = key ? CALL_HANDLERS[key] : undefined;
  if (handler) {
    const label = handler(record);
    if (label) {
      return label;
    }
  }
  return record.title?.trim() || null;
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

/** The calls in a block's tool results, flattened in the order they ran. */
export function getCallRecords(
  toolResults: Array<{structuredContent?: {calls?: CallRecord[]} | null} | null> | null
): CallRecord[] {
  return (toolResults ?? []).flatMap(result => result?.structuredContent?.calls ?? []);
}
