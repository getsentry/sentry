import {Theme} from '@emotion/react';
import cronstrue from 'cronstrue';
import {Location} from 'history';

import {t, tn} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {shouldUse24Hours} from 'sentry/utils/dates';
import {CheckInStatus, MonitorConfig, ScheduleType} from 'sentry/views/monitors/types';

export function makeMonitorListQueryKey(organization: Organization, location: Location) {
  const {query, project, environment} = location.query;

  return [
    `/organizations/${organization.slug}/monitors/`,
    {query: {query, project, environment, includeNew: true, per_page: 20}},
  ] as const;
}

export function crontabAsText(crontabInput: string | null): string | null {
  if (!crontabInput) {
    return null;
  }
  let parsedSchedule: string;
  try {
    parsedSchedule = cronstrue.toString(crontabInput, {
      verbose: false,
      use24HourTimeFormat: shouldUse24Hours(),
    });
  } catch (_e) {
    return null;
  }

  return parsedSchedule;
}

export function scheduleAsText(config: MonitorConfig) {
  // Crontab format uses cronstrue
  if (config.schedule_type === ScheduleType.CRONTAB) {
    const parsedSchedule = crontabAsText(config.schedule);
    return parsedSchedule ?? t('Unknown schedule');
  }

  // Interval format is simpler
  const [value, timeUnit] = config.schedule;

  if (timeUnit === 'minute') {
    return tn('Every minute', 'Every %s minutes', value);
  }

  if (timeUnit === 'hour') {
    return tn('Every hour', 'Every %s hours', value);
  }

  if (timeUnit === 'day') {
    return tn('Every day', 'Every %s days', value);
  }

  if (timeUnit === 'week') {
    return tn('Every week', 'Every %s weeks', value);
  }

  if (timeUnit === 'month') {
    return tn('Every month', 'Every %s months', value);
  }

  return t('Unknown schedule');
}

export const statusToText: Record<CheckInStatus, string> = {
  [CheckInStatus.OK]: t('Okay'),
  [CheckInStatus.ERROR]: t('Failed'),
  [CheckInStatus.IN_PROGRESS]: t('In Progress'),
  [CheckInStatus.MISSED]: t('Missed'),
  [CheckInStatus.TIMEOUT]: t('Timed Out'),
};

export function getColorsFromStatus(status: CheckInStatus, theme: Theme) {
  const statusToColor: Record<CheckInStatus, {labelColor: string; tickColor: string}> = {
    [CheckInStatus.ERROR]: {tickColor: theme.red200, labelColor: theme.red300},
    [CheckInStatus.TIMEOUT]: {tickColor: theme.red200, labelColor: theme.red300},
    [CheckInStatus.OK]: {tickColor: theme.green200, labelColor: theme.green300},
    [CheckInStatus.MISSED]: {tickColor: theme.yellow200, labelColor: theme.yellow300},
    [CheckInStatus.IN_PROGRESS]: {tickColor: theme.disabled, labelColor: theme.disabled},
  };
  return statusToColor[status];
}
