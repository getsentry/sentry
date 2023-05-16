import cronstrue from 'cronstrue';

import {t, tn} from 'sentry/locale';
import {shouldUse24Hours} from 'sentry/utils/dates';
import {MonitorConfig, ScheduleType} from 'sentry/views/monitors/types';

export function crontabAsText(crontabInput: string | null): string | null {
  if (!crontabInput) {
    return null;
  }
  let parsedSchedule: string;
  try {
    parsedSchedule = cronstrue.toString(crontabInput, {
      verbose: true,
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
