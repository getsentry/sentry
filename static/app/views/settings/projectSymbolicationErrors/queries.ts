import {useQuery} from '@tanstack/react-query';

import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import {STATS_INTERVAL, STATS_PERIOD, SYMBOLICATION_ERROR_TYPES_QUERY} from './constants';

const STALE_TIME = 60_000;
const REFERRER = 'api.project-settings.symbolication-errors';

// One page holds as many rows as the stats endpoint returns top events, so one
// stats request draws the trend of every row on the page.
export const PAGE_SIZE = 10;

// The chart above the table shows this many causes. Rows with another cause
// draw their trend in the neutral colour.
export const CHART_CAUSES = 5;

export interface FailureRow {
  'count_unique(event_id)': number;
  error_type: string;
  group_id: number | string;
  'project.id': number | string;
  title: string;
}

export const FAILURE_FIELDS = [
  'project.id',
  'group_id',
  'title',
  'error_type',
  'count_unique(event_id)',
];

export function useSymbolicationFailures({
  project,
  cursor,
}: {
  cursor: string | undefined;
  project: Project;
}) {
  const organization = useOrganization();

  return useQuery({
    ...apiOptions.as<{data: FailureRow[]}>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: 'processing_errors',
          field: FAILURE_FIELDS,
          query: SYMBOLICATION_ERROR_TYPES_QUERY,
          sort: '-count_unique(event_id)',
          per_page: PAGE_SIZE,
          cursor,
          statsPeriod: STATS_PERIOD,
          project: project.id,
          referrer: REFERRER,
        },
        staleTime: STALE_TIME,
      }
    ),
    select: selectJsonWithHeaders,
    retry: false,
  });
}

export interface IssueVolume {
  'count()': number;
  issue: string;
  'issue.id': number | string;
}

export const ISSUE_VOLUME_FIELDS = ['issue.id', 'issue', 'count()'];

/** Every event of the listed issues in the period, with the issue short id. */
export function useIssueVolumes({
  project,
  groupIds,
}: {
  groupIds: string[];
  project: Project;
}) {
  const organization = useOrganization();

  return useQuery({
    ...apiOptions.as<{data: IssueVolume[]}>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: 'errors',
          field: ISSUE_VOLUME_FIELDS,
          query: `issue.id:[${groupIds.join(',')}]`,
          per_page: PAGE_SIZE,
          statsPeriod: STATS_PERIOD,
          project: project.id,
          referrer: REFERRER,
        },
        staleTime: STALE_TIME,
      }
    ),
    enabled: groupIds.length > 0,
    retry: false,
  });
}

export function trendKey(row: Pick<FailureRow, 'group_id' | 'error_type'>): string {
  return `${row.group_id},${row.error_type}`;
}

function trendQuery(rows: FailureRow[]): string {
  const pairs = rows
    .map(row => `(group_id:${row.group_id} error_type:${row.error_type})`)
    .join(' OR ');
  return `${SYMBOLICATION_ERROR_TYPES_QUERY} (${pairs})`;
}

/** One failure time series per row, keyed by `trendKey`. */
export function useFailureTrends({
  project,
  rows,
}: {
  project: Project;
  rows: FailureRow[];
}) {
  const organization = useOrganization();

  return useQuery({
    ...apiOptions.as<MultiSeriesEventsStats>()(
      '/organizations/$organizationIdOrSlug/events-stats/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: 'processing_errors',
          field: ['group_id', 'error_type', 'count_unique(event_id)'],
          yAxis: 'count_unique(event_id)',
          topEvents: PAGE_SIZE,
          excludeOther: 1,
          query: trendQuery(rows),
          statsPeriod: STATS_PERIOD,
          interval: STATS_INTERVAL,
          project: project.id,
          referrer: REFERRER,
        },
        staleTime: STALE_TIME,
      }
    ),
    enabled: rows.length > 0,
    retry: false,
  });
}

/** Failures per day for the most common causes, keyed by cause. */
export function useCauseTimeseries({project}: {project: Project}) {
  const organization = useOrganization();

  return useQuery({
    ...apiOptions.as<EventsStats | MultiSeriesEventsStats>()(
      '/organizations/$organizationIdOrSlug/events-stats/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: 'processing_errors',
          field: ['error_type', 'count_unique(event_id)'],
          yAxis: 'count_unique(event_id)',
          topEvents: CHART_CAUSES,
          excludeOther: 1,
          query: SYMBOLICATION_ERROR_TYPES_QUERY,
          statsPeriod: STATS_PERIOD,
          interval: STATS_INTERVAL,
          project: project.id,
          referrer: REFERRER,
        },
        staleTime: STALE_TIME,
      }
    ),
    retry: false,
  });
}
