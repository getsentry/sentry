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
  /**
   * Fields to request per row. `timestamp` and `project.id` are added for every
   * dataset — the first is what the timeline sorts and merges on, the second is
   * what the detail panel resolves a project slug from.
   */
  fields: string[];
  /** Where clicking the row navigates. `undefined` renders the row unlinked. */
  getLink: (row: Row, ctx: LinkContext) => LocationDescriptor | undefined;
  /** Primary text for the row. */
  getTitle: (row: Row) => string;
  /** Optional trailing detail (op, severity, value, …). */
  getDetail?: (row: Row) => string | undefined;
  /**
   * Duration in ms, for the datasets that have one. Left unset for datasets whose
   * items are instants, which is how the rail decides not to draw a bar.
   */
  getDuration?: (row: Row) => number | undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function ms(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

/**
 * Query params that mean something only to this timeline: the open item, the lane
 * and text filters, the sort. The trace-view link builders carry the whole current
 * query across to their target, so these have to come off first — `item` most of
 * all, since a target that still carries it would arrive with the details panel
 * open over it.
 */
const SESSION_ONLY_PARAMS = ['item', 'query', 'sort', 'telemetryType'] as const;

function withoutSessionParams(location: Location): Location {
  const query = {...location.query};
  SESSION_ONLY_PARAMS.forEach(param => {
    delete query[param];
  });
  return {...location, query};
}

/**
 * The trace waterfall, with nothing preselected. The row's timestamp puts the
 * trace view on a date range that contains it.
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
    location: withoutSessionParams(location),
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
 * - **traces** → the trace waterfall, at the trace rather than at the segment
 *   span the row was built from. The row stands for the whole trace, so that is
 *   what it opens.
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
  traces: {
    fields: [
      'id',
      'span.description',
      'span.op',
      'span.duration',
      'trace',
      'project',
      'transaction',
    ],
    // The transaction name is what a trace is called; the segment span's
    // description and op are the fallbacks when it has none.
    getTitle: row =>
      str(row.transaction) ??
      str(row['span.description']) ??
      str(row['span.op']) ??
      t('(unknown)'),
    getDetail: row => str(row['span.op']),
    // `span.duration` is already milliseconds. On a segment span this is the
    // trace's own wall-clock duration, which is what the swimlane draws.
    getDuration: row => ms(row['span.duration']),
    getLink: getTraceLink,
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
        location: withoutSessionParams(location),
        traceSlug,
        timestamp,
        tab: TraceLayoutTabKeys.METRICS,
      });
    },
  },
};
