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
  CheckInStatus.SUB_FAILURE_ERROR,
  CheckInStatus.SUB_RECOVERY_OK,
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
  [CheckInStatus.SUB_FAILURE_ERROR]: t('Failed (Sub-Threshold)'),
  [CheckInStatus.SUB_RECOVERY_OK]: t('Okay (Sub-Threshold)'),
};

export const tickStyle: TickStyle<CheckInStatus> = theme => ({
  [CheckInStatus.ERROR]: {
    labelColor: theme.colors.red500,
    tickColor: theme.colors.red400,
  },
  [CheckInStatus.TIMEOUT]: {
    labelColor: theme.colors.red500,
    tickColor: theme.colors.red400,
    hatchTick: theme.colors.red200,
  },
  [CheckInStatus.OK]: {
    labelColor: theme.colors.green500,
    tickColor: theme.colors.green400,
  },
  [CheckInStatus.MISSED]: {
    labelColor: theme.colors.yellow500,
    tickColor: theme.colors.yellow400,
  },
  [CheckInStatus.IN_PROGRESS]: {
    labelColor: theme.tokens.content.disabled,
    tickColor: theme.tokens.content.disabled,
  },
  [CheckInStatus.UNKNOWN]: {
    labelColor: theme.colors.gray500,
    tickColor: theme.colors.gray400,
    hatchTick: theme.colors.gray200,
  },
  [CheckInStatus.SUB_FAILURE_ERROR]: {
    labelColor: theme.colors.red500,
    tickColor: theme.colors.red400,
    hatchTick: theme.colors.red200,
  },
  [CheckInStatus.SUB_RECOVERY_OK]: {
    labelColor: theme.colors.green500,
    tickColor: theme.colors.green400,
    hatchTick: theme.colors.green200,
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
