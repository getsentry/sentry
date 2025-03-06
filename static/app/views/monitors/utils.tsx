import type {TickStyle} from 'sentry/components/checkInTimeline/types';
import {t, tn} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';

import {CheckInStatus} from './types';

export function makeMonitorListQueryKey(
  organization: Organization,
  params: Record<string, any>
) {
  const {query, project, environment, owner, cursor, sort, asc} = params;

  return [
    `/organizations/${organization.slug}/monitors/`,
    {
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
    },
  ] as const;
}

export function makeMonitorDetailsQueryKey(
  organization: Organization,
  projectId: string,
  monitorSlug: string,
  query?: Record<string, any>
) {
  return [
    `/projects/${organization.slug}/${projectId}/monitors/${monitorSlug}/`,
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

export const tickStyle: Record<CheckInStatus, TickStyle> = {
  [CheckInStatus.ERROR]: {
    labelColor: 'red400',
    tickColor: 'red300',
  },
  [CheckInStatus.TIMEOUT]: {
    labelColor: 'red400',
    tickColor: 'red300',
    hatchTick: 'red200',
  },
  [CheckInStatus.OK]: {
    labelColor: 'green400',
    tickColor: 'green300',
  },
  [CheckInStatus.MISSED]: {
    labelColor: 'yellow400',
    tickColor: 'yellow300',
  },
  [CheckInStatus.IN_PROGRESS]: {
    labelColor: 'disabled',
    tickColor: 'disabled',
  },
  [CheckInStatus.UNKNOWN]: {
    labelColor: 'gray400',
    tickColor: 'gray300',
    hatchTick: 'gray200',
  },
};

export const getScheduleIntervals = (n: number): Array<SelectValue<string>> => [
  {value: 'minute', label: tn('minute', 'minutes', n)},
  {value: 'hour', label: tn('hour', 'hours', n)},
  {value: 'day', label: tn('day', 'days', n)},
  {value: 'week', label: tn('week', 'weeks', n)},
  {value: 'month', label: tn('month', 'months', n)},
  {value: 'year', label: tn('year', 'years', n)},
];
