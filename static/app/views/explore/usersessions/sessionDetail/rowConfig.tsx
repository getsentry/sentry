import type {Location, LocationDescriptor} from 'history';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {LOGS_QUERY_KEY} from 'sentry/views/explore/contexts/logs/logsPageParams';
import type {SessionDatasetKey} from 'sentry/views/explore/usersessions/datasets';
import {TraceLayoutTabKeys} from 'sentry/views/performance/newTraceDetails/useTraceLayoutTabs';

export type Row = Record<string, unknown>;

export interface LinkContext {
  /** Normalized page-filter datetime params, so the target lands on a range that contains the event. */
  dateParams: Record<string, any>;
  location: Location;
  organization: Organization;
}

interface RowConfig {
  /** Fields to request per row. `timestamp` is added for every dataset. */
  fields: string[];
  /** Where clicking the row navigates. `undefined` renders the row unlinked. */
  getLink: (row: Row, ctx: LinkContext) => LocationDescriptor | undefined;
  /** Primary text for the row. */
  getTitle: (row: Row) => string;
  /** Optional trailing detail (op, severity, value, …). */
  getDetail?: (row: Row) => string | undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

/**
 * Trace-level link for a run of spans: the waterfall with nothing preselected.
 * Takes the run's leading span, whose timestamp puts the trace view on a date
 * range that contains it. Individual spans still link to themselves.
 */
export function getTraceLink(
  row: Row,
  {organization, location}: Pick<LinkContext, 'location' | 'organization'>
): LocationDescriptor | undefined {
  const traceSlug = str(row.trace);
  const timestamp = str(row.timestamp);
  if (!traceSlug || !timestamp) {
    return undefined;
  }
  return generateLinkToEventInTraceView({
    organization,
    location,
    traceSlug,
    timestamp,
  });
}

/**
 * Per-dataset row fields and deep links for the session timeline.
 *
 * Every dataset exposes a plain `timestamp` field (only `min`/`max` over it are
 * rejected on EAP), so the timeline sorts and merges on one uniform key.
 *
 * Link targets differ in how precisely they can address a single item:
 *
 * - **errors** → the issue's event detail page, addressing the exact event.
 * - **spans** → the trace waterfall with the span preselected via the `node`
 *   path, plus its enclosing transaction so the tree expands to it.
 * - **logs** → the logs explorer filtered to `id:<logId>`. The trace view's logs
 *   tab can also highlight a row (`logsRowId`), but only when that row is
 *   already loaded, so filtering is the reliable target.
 * - **metrics** → the trace view's metrics tab. There is no per-item deep link
 *   for a trace metric, so this is trace-level only.
 */
export const ROW_CONFIG: Record<SessionDatasetKey, RowConfig> = {
  errors: {
    fields: ['id', 'issue', 'issue.id', 'title', 'level', 'trace', 'project'],
    getTitle: row => str(row.title) ?? str(row.issue) ?? t('(unknown)'),
    getDetail: row => str(row.level),
    getLink: (row, {organization}) => {
      const rawGroupId = row['issue.id'];
      const groupId =
        typeof rawGroupId === 'number' || typeof rawGroupId === 'string'
          ? String(rawGroupId)
          : undefined;
      const eventId = str(row.id);
      if (!groupId || !eventId) {
        return;
      }
      return `/organizations/${organization.slug}/issues/${groupId}/events/${eventId}/`;
    },
  },
  spans: {
    fields: [
      'id',
      'span.description',
      'span.op',
      'span.duration',
      'trace',
      'project',
      'transaction',
      'transaction.span_id',
    ],
    getTitle: row =>
      str(row['span.description']) ?? str(row['span.op']) ?? t('(unknown)'),
    getDetail: row => str(row['span.op']),
    getLink: (row, {organization, location}) => {
      const traceSlug = str(row.trace);
      const spanId = str(row.id);
      const timestamp = str(row.timestamp);
      if (!traceSlug || !spanId || !timestamp) {
        return;
      }
      return generateLinkToEventInTraceView({
        organization,
        location,
        traceSlug,
        spanId,
        targetId: str(row['transaction.span_id']),
        timestamp,
      });
    },
  },
  logs: {
    fields: ['id', 'message', 'severity', 'trace', 'project'],
    getTitle: row => str(row.message) ?? t('(unknown)'),
    getDetail: row => str(row.severity),
    getLink: (row, {organization, dateParams}) => {
      const logId = str(row.id);
      if (!logId) {
        return;
      }
      return {
        pathname: `/organizations/${organization.slug}/explore/logs/`,
        query: {...dateParams, [LOGS_QUERY_KEY]: `id:${logId}`},
      };
    },
  },
  metrics: {
    fields: ['id', 'metric.name', 'metric.type', 'value', 'trace', 'project'],
    getTitle: row => str(row['metric.name']) ?? t('(unknown)'),
    getDetail: row =>
      typeof row.value === 'number' ? String(row.value) : str(row['metric.type']),
    getLink: (row, {organization, location}) => {
      const traceSlug = str(row.trace);
      const timestamp = str(row.timestamp);
      if (!traceSlug || !timestamp) {
        return;
      }
      // No per-item deep link exists for trace metrics; land on the trace's
      // metrics tab instead.
      return generateLinkToEventInTraceView({
        organization,
        location,
        traceSlug,
        timestamp,
        tab: TraceLayoutTabKeys.METRICS,
      });
    },
  },
};
