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

export const tickStyle: TickStyle<CheckInStatus> = theme => ({
  [CheckInStatus.ERROR]: {
    labelColor: theme.isChonk ? theme.tokens.content.danger : theme.red400,
    tickColor: theme.isChonk ? theme.tokens.graphics.danger : theme.red300,
  },
  [CheckInStatus.TIMEOUT]: {
    labelColor: theme.isChonk ? theme.tokens.content.danger : theme.red400,
    tickColor: theme.isChonk ? theme.tokens.graphics.danger : theme.red300,
    hatchTick: theme.isChonk ? theme.tokens.graphics.danger : theme.red200,
  },
  [CheckInStatus.OK]: {
    labelColor: theme.isChonk ? theme.tokens.content.success : theme.green400,
    tickColor: theme.isChonk ? theme.tokens.graphics.success : theme.green300,
  },
  [CheckInStatus.MISSED]: {
    labelColor: theme.isChonk ? theme.tokens.content.warning : theme.yellow400,
    tickColor: theme.isChonk ? theme.tokens.graphics.warning : theme.yellow300,
  },
  [CheckInStatus.IN_PROGRESS]: {
    labelColor: theme.isChonk ? theme.tokens.content.muted : theme.disabled,
    tickColor: theme.isChonk ? theme.tokens.graphics.muted : theme.disabled,
  },
  [CheckInStatus.UNKNOWN]: {
    labelColor: theme.isChonk ? theme.tokens.content.muted : theme.gray400,
    tickColor: theme.isChonk ? theme.tokens.graphics.muted : theme.gray300,
    hatchTick: theme.isChonk ? theme.tokens.border.muted : theme.gray200,
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
