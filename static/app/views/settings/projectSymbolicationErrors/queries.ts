import {skipToken} from '@tanstack/react-query';

import type {
  EventsStats,
  MultiSeriesEventsStats,
  Organization,
} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';

import {STATS_INTERVAL, STATS_PERIOD, SYMBOLICATION_ERROR_TYPES_QUERY} from './constants';

const STALE_TIME = 60_000;
const REFERRER = 'api.project-settings.symbolication-errors';

// One page holds as many rows as the stats endpoint returns top events, so one
// stats request draws the trend of every row on the page.
const PAGE_SIZE = 10;

// The chart above the table shows this many causes. The stats endpoint adds
// the rest under this key.
const CHART_CAUSES = 10;
export const OTHER_CAUSES = 'Other';

export interface FailureRow {
  'count_unique(event_id)': number;
  error_type: string;
  group_id: number | string;
  title: string;
}

export const FAILURE_FIELDS = [
  'group_id',
  'title',
  'error_type',
  'count_unique(event_id)',
];

interface ProjectQueryParams {
  organization: Organization;
  project: Project;
}

export function symbolicationFailuresOptions({
  organization,
  project,
  cursor,
}: ProjectQueryParams & {cursor: string | undefined}) {
  return {
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
    retry: false,
  };
}

export interface IssueVolume {
  'count()': number;
  issue: string;
  'issue.id': number | string;
}

export const ISSUE_VOLUME_FIELDS = ['issue.id', 'issue', 'count()'];

export function issueVolumesOptions({
  organization,
  project,
  groupIds,
}: ProjectQueryParams & {groupIds: string[]}) {
  return {
    ...apiOptions.as<{data: IssueVolume[]}>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: groupIds.length > 0 ? {organizationIdOrSlug: organization.slug} : skipToken,
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
    retry: false,
  };
}

export function issueVolumeTrendsOptions({
  organization,
  project,
  groupIds,
}: ProjectQueryParams & {groupIds: string[]}) {
  return {
    ...apiOptions.as<MultiSeriesEventsStats>()(
      '/organizations/$organizationIdOrSlug/events-stats/',
      {
        path: groupIds.length > 0 ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {
          dataset: 'errors',
          field: ['issue', 'count()'],
          yAxis: 'count()',
          topEvents: PAGE_SIZE,
          excludeOther: 1,
          query: `issue.id:[${groupIds.join(',')}]`,
          statsPeriod: STATS_PERIOD,
          interval: STATS_INTERVAL,
          project: project.id,
          referrer: REFERRER,
        },
        staleTime: STALE_TIME,
      }
    ),
    retry: false,
  };
}

export function trendKey(row: Pick<FailureRow, 'group_id' | 'error_type'>): string {
  return `${row.group_id},${row.error_type}`;
}

function trendQuery(rows: FailureRow[]): string {
  const pairs = rows.map(row => `(${failureQuery(row)})`).join(' OR ');
  return `${SYMBOLICATION_ERROR_TYPES_QUERY} (${pairs})`;
}

export function failureTrendsOptions({
  organization,
  project,
  rows,
}: ProjectQueryParams & {rows: FailureRow[]}) {
  return {
    ...apiOptions.as<MultiSeriesEventsStats>()(
      '/organizations/$organizationIdOrSlug/events-stats/',
      {
        path: rows.length > 0 ? {organizationIdOrSlug: organization.slug} : skipToken,
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
    retry: false,
  };
}

export function causeTimeseriesOptions({organization, project}: ProjectQueryParams) {
  return {
    ...apiOptions.as<EventsStats | MultiSeriesEventsStats>()(
      '/organizations/$organizationIdOrSlug/events-stats/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: 'processing_errors',
          field: ['error_type', 'count_unique(event_id)'],
          yAxis: 'count_unique(event_id)',
          topEvents: CHART_CAUSES,
          sort: '-count_unique(event_id)',
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
  };
}

export function totalEventsTimeseriesOptions({
  organization,
  project,
}: ProjectQueryParams) {
  return {
    ...apiOptions.as<EventsStats>()(
      '/organizations/$organizationIdOrSlug/events-stats/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: 'errors',
          yAxis: 'count()',
          statsPeriod: STATS_PERIOD,
          interval: STATS_INTERVAL,
          project: project.id,
          referrer: REFERRER,
        },
        staleTime: STALE_TIME,
      }
    ),
    retry: false,
  };
}

type FailureKey = Pick<FailureRow, 'group_id' | 'error_type'>;

function failureQuery(failure: FailureKey): string {
  return `group_id:${failure.group_id} error_type:${failure.error_type}`;
}

export interface ReleaseFailures {
  'count_unique(event_id)': number;
  release: string | null;
}

// The detail drawer lists this many releases.
const RELEASE_LIMIT = 5;

export function releaseFailuresOptions({
  organization,
  project,
  failure,
}: ProjectQueryParams & {failure: FailureKey}) {
  return {
    ...apiOptions.as<{data: ReleaseFailures[]}>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: 'processing_errors',
          field: ['release', 'count_unique(event_id)'],
          query: failureQuery(failure),
          sort: '-count_unique(event_id)',
          per_page: RELEASE_LIMIT,
          statsPeriod: STATS_PERIOD,
          project: project.id,
          referrer: REFERRER,
        },
        staleTime: STALE_TIME,
      }
    ),
    retry: false,
  };
}

export function sampleEventOptions({
  organization,
  project,
  failure,
}: ProjectQueryParams & {failure: FailureKey}) {
  return {
    ...apiOptions.as<{data: Array<{event_id: string}>}>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: 'processing_errors',
          field: ['event_id'],
          query: failureQuery(failure),
          per_page: 1,
          statsPeriod: STATS_PERIOD,
          project: project.id,
          referrer: REFERRER,
        },
        staleTime: STALE_TIME,
      }
    ),
    retry: false,
  };
}
