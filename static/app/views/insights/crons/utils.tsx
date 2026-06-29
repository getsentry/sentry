import type {SelectValue} from '@sentry/scraps/select';

import type {TickStyle} from 'sentry/components/checkInTimeline/types';
import {t, tn} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';

import {CheckInStatus, type Monitor} from './types';

export function monitorListApiOptions(
  organization: Organization,
  queryParams: Partial<
    Record<
      'asc' | 'cursor' | 'environment' | 'owner' | 'project' | 'query' | 'sort',
      unknown
    >
  >
) {
  const {query, project, environment, owner, cursor, sort, asc} = queryParams;
  return apiOptions.as<Monitor[]>()('/organizations/$organizationIdOrSlug/monitors/', {
    path: {organizationIdOrSlug: organization.slug},
    query: {
      cursor,
      query,
      project,
      environment,
      owner,
      includeNew: true,
      per_page: 20,
      sort,
      asc,
    },
    staleTime: 0,
  });
}

export function makeMonitorDetailsQueryKey(
  organization: Organization,
  projectId: string,
  monitorSlug: string,
  query?: Record<string, any>
) {
  return [
    getApiUrl(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/monitors/$monitorIdOrSlug/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: projectId,
          monitorIdOrSlug: monitorSlug,
        },
      }
    ),
    {query},
  ] as const;
}

// Orders the status in terms of ascending precedence for showing to the user
export const checkInStatusPrecedent: CheckInStatus[] = [
  CheckInStatus.UNKNOWN,
  CheckInStatus.ERROR,
  CheckInStatus.TIMEOUT,
  CheckInStatus.MISSED,
  CheckInStatus.OK,
  CheckInStatus.IN_PROGRESS,
];

export const statusToText: Record<CheckInStatus, string> = {
  [CheckInStatus.OK]: t('Okay'),
  [CheckInStatus.ERROR]: t('Failed'),
  [CheckInStatus.IN_PROGRESS]: t('In Progress'),
  [CheckInStatus.MISSED]: t('Missed'),
  [CheckInStatus.TIMEOUT]: t('Timed Out'),
  [CheckInStatus.UNKNOWN]: t('Unknown'),
};

export const tickStyle: TickStyle<CheckInStatus> = theme => ({
  [CheckInStatus.ERROR]: {
    labelColor: theme.tokens.content.danger,
    tickColor: theme.tokens.dataviz.semantic.bad,
  },
  [CheckInStatus.TIMEOUT]: {
    labelColor: theme.tokens.content.danger,
    tickColor: theme.tokens.dataviz.semantic.bad,
    hatchTick: theme.tokens.border.danger.muted,
  },
  [CheckInStatus.OK]: {
    labelColor: theme.tokens.content.success,
    tickColor: theme.tokens.dataviz.semantic.good,
  },
  [CheckInStatus.MISSED]: {
    labelColor: theme.tokens.content.warning,
    tickColor: theme.tokens.dataviz.semantic.meh,
  },
  [CheckInStatus.IN_PROGRESS]: {
    labelColor: theme.tokens.content.disabled,
    tickColor: theme.tokens.content.disabled,
  },
  [CheckInStatus.UNKNOWN]: {
    labelColor: theme.tokens.content.secondary,
    tickColor: theme.tokens.dataviz.semantic.neutral,
    hatchTick: theme.tokens.border.neutral.muted,
  },
});

export const getScheduleIntervals = (n: number): Array<SelectValue<string>> => [
  {value: 'minute', label: tn('minute', 'minutes', n)},
  {value: 'hour', label: tn('hour', 'hours', n)},
  {value: 'day', label: tn('day', 'days', n)},
  {value: 'week', label: tn('week', 'weeks', n)},
  {value: 'month', label: tn('month', 'months', n)},
  {value: 'year', label: tn('year', 'years', n)},
];
