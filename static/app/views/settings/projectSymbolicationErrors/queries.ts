import {skipToken} from '@tanstack/react-query';

import type {
  EventsStats,
  MultiSeriesEventsStats,
  Organization,
} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';

import {STATS_INTERVAL, STATS_PERIOD, SYMBOLICATION_ERROR_TYPES_QUERY} from './constants';

const STALE_TIME_MS = 60_000;
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

/** The page shows only the failures that match each filter that is set. */
export interface FailureFilters {
  cause?: string;
  environment?: string;
  platform?: string;
  release?: string;
}

interface ProjectQueryParams {
  filters: FailureFilters;
  organization: Organization;
  project: Project;
}

function condition(key: string, value: string | undefined): string[] {
  return value
    ? [`${key}:"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`]
    : [];
}

function failureConditions(filters: FailureFilters): string {
  return [
    filters.cause ? `error_type:${filters.cause}` : SYMBOLICATION_ERROR_TYPES_QUERY,
    ...condition('environment', filters.environment),
    ...condition('release', filters.release),
    ...condition('platform', filters.platform),
  ].join(' ');
}

// The errors dataset has no cause, and it names the platform differently.
function eventConditions(filters: FailureFilters): string {
  return [
    ...condition('environment', filters.environment),
    ...condition('release', filters.release),
    ...condition('platform.name', filters.platform),
  ].join(' ');
}

export type FilterField = 'error_type' | 'environment' | 'release' | 'platform';

// A filter offers this many values, the values with the most failures first.
const FILTER_VALUE_LIMIT = 50;

export function filterValuesOptions({
  organization,
  project,
  field,
}: Omit<ProjectQueryParams, 'filters'> & {field: FilterField}) {
  return {
    ...apiOptions.as<{data: Array<Partial<Record<FilterField, string | null>>>}>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: 'processing_errors',
          field: [field, 'count_unique(event_id)'],
          query: SYMBOLICATION_ERROR_TYPES_QUERY,
          sort: '-count_unique(event_id)',
          per_page: FILTER_VALUE_LIMIT,
          statsPeriod: STATS_PERIOD,
          project: project.id,
          referrer: REFERRER,
        },
        staleTime: STALE_TIME_MS,
      }
    ),
    retry: false,
  };
}

export function symbolicationFailuresOptions({
  organization,
  project,
  filters,
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
          query: failureConditions(filters),
          sort: '-count_unique(event_id)',
          per_page: PAGE_SIZE,
          cursor,
          statsPeriod: STATS_PERIOD,
          project: project.id,
          referrer: REFERRER,
        },
        staleTime: STALE_TIME_MS,
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
  filters,
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
          query: `issue.id:[${groupIds.join(',')}] ${eventConditions(filters)}`,
          per_page: PAGE_SIZE,
          statsPeriod: STATS_PERIOD,
          project: project.id,
          referrer: REFERRER,
        },
        staleTime: STALE_TIME_MS,
      }
    ),
    retry: false,
  };
}

export function issueVolumeTrendsOptions({
  organization,
  project,
  filters,
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
          query: `issue.id:[${groupIds.join(',')}] ${eventConditions(filters)}`,
          statsPeriod: STATS_PERIOD,
          interval: STATS_INTERVAL,
          project: project.id,
          referrer: REFERRER,
        },
        staleTime: STALE_TIME_MS,
      }
    ),
    retry: false,
  };
}

export function trendKey(row: Pick<FailureRow, 'group_id' | 'error_type'>): string {
  return `${row.group_id},${row.error_type}`;
}

function trendQuery(rows: FailureRow[], filters: FailureFilters): string {
  const pairs = rows
    .map(row => `(group_id:${row.group_id} error_type:${row.error_type})`)
    .join(' OR ');
  return `${failureConditions(filters)} (${pairs})`;
}

export function failureTrendsOptions({
  organization,
  project,
  filters,
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
          query: trendQuery(rows, filters),
          statsPeriod: STATS_PERIOD,
          interval: STATS_INTERVAL,
          project: project.id,
          referrer: REFERRER,
        },
        staleTime: STALE_TIME_MS,
      }
    ),
    retry: false,
  };
}

export function causeTimeseriesOptions({
  organization,
  project,
  filters,
}: ProjectQueryParams) {
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
          query: failureConditions(filters),
          statsPeriod: STATS_PERIOD,
          interval: STATS_INTERVAL,
          project: project.id,
          referrer: REFERRER,
        },
        staleTime: STALE_TIME_MS,
      }
    ),
    retry: false,
  };
}

// An event with two causes is in two cause series. This series has each
// failed event one time.
export function failedEventsTimeseriesOptions({
  organization,
  project,
  filters,
}: ProjectQueryParams) {
  return {
    ...apiOptions.as<EventsStats>()(
      '/organizations/$organizationIdOrSlug/events-stats/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: 'processing_errors',
          yAxis: 'count_unique(event_id)',
          query: failureConditions(filters),
          statsPeriod: STATS_PERIOD,
          interval: STATS_INTERVAL,
          project: project.id,
          referrer: REFERRER,
        },
        staleTime: STALE_TIME_MS,
      }
    ),
    retry: false,
  };
}

export function totalEventsTimeseriesOptions({
  organization,
  project,
  filters,
}: ProjectQueryParams) {
  return {
    ...apiOptions.as<EventsStats>()(
      '/organizations/$organizationIdOrSlug/events-stats/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: 'errors',
          yAxis: 'count()',
          query: eventConditions(filters),
          statsPeriod: STATS_PERIOD,
          interval: STATS_INTERVAL,
          project: project.id,
          referrer: REFERRER,
        },
        staleTime: STALE_TIME_MS,
      }
    ),
    retry: false,
  };
}

type FailureKey = Pick<FailureRow, 'group_id' | 'error_type'>;

// One issue and cause, within the filters of the page.
function failureQuery(failure: FailureKey, filters: FailureFilters): string {
  return `group_id:${failure.group_id} ${failureConditions({...filters, cause: failure.error_type})}`;
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
  filters,
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
          query: failureQuery(failure, filters),
          sort: '-count_unique(event_id)',
          per_page: RELEASE_LIMIT,
          statsPeriod: STATS_PERIOD,
          project: project.id,
          referrer: REFERRER,
        },
        staleTime: STALE_TIME_MS,
      }
    ),
    retry: false,
  };
}

export function sampleEventOptions({
  organization,
  project,
  filters,
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
          query: failureQuery(failure, filters),
          per_page: 1,
          statsPeriod: STATS_PERIOD,
          project: project.id,
          referrer: REFERRER,
        },
        staleTime: STALE_TIME_MS,
      }
    ),
    retry: false,
  };
}

export interface FailedFile {
  'count_unique(event_id)': number;
  debug_id: string | null;
  file_name: string | null;
}

// The detail drawer lists this many files.
const FILE_LIMIT = 10;

// The files that failed for one issue and cause: the debug file of an image, the
// URL of a script or the ProGuard mapping.
export function failedFilesOptions({
  organization,
  project,
  filters,
  failure,
}: ProjectQueryParams & {failure: FailureKey}) {
  return {
    ...apiOptions.as<{data: FailedFile[]}>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: 'processing_errors',
          field: ['file_name', 'debug_id', 'count_unique(event_id)'],
          query: failureQuery(failure, filters),
          sort: '-count_unique(event_id)',
          per_page: FILE_LIMIT,
          statsPeriod: STATS_PERIOD,
          project: project.id,
          referrer: REFERRER,
        },
        staleTime: STALE_TIME_MS,
      }
    ),
    retry: false,
  };
}

// The debug files and ProGuard mappings that the project has for one debug ID.
// A result means the user uploaded the file after the events failed. The user
// uploads in a terminal while the page is open, so the answer is never cached:
// each open of the drawer and each return to the tab asks again.
export function uploadedDebugFilesOptions({
  organization,
  project,
  debugId,
}: Omit<ProjectQueryParams, 'filters'> & {debugId: string}) {
  return {
    ...apiOptions.as<Array<{id: string}>>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/files/dsyms/',
      {
        path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
        query: {debug_id: debugId},
        staleTime: 0,
      }
    ),
    refetchOnWindowFocus: true,
  };
}

// Sentry asks again this often while an issue of the page is reprocessing.
export const REPROCESSING_POLL_MS = 5_000;

export interface IssueStatus {
  id: string;
  status: string;
  // Present while the issue reprocesses. `info` is null until the reprocess
  // knows its number of events.
  statusDetails?: {info?: {totalEvents: number} | null; pendingEvents?: number};
}

// The status of the issues of the page. Never cached: the page reloads after
// the user starts a reprocess, and must then show it.
export function issueStatusesOptions({
  organization,
  project,
  groupIds,
}: Omit<ProjectQueryParams, 'filters'> & {groupIds: string[]}) {
  return apiOptions.as<IssueStatus[]>()('/organizations/$organizationIdOrSlug/issues/', {
    path: groupIds.length > 0 ? {organizationIdOrSlug: organization.slug} : skipToken,
    query: {group: groupIds, project: project.id, collapse: ['stats', 'lifetime']},
    staleTime: 0,
  });
}
