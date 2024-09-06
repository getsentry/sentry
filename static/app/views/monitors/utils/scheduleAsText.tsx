import {t, tn} from 'sentry/locale';
import type {MonitorConfig} from 'sentry/views/monitors/types';
import {ScheduleType} from 'sentry/views/monitors/types';

import {crontabAsText} from './crontabAsText';

/**
 * Display a human readable label for the shedule of a MonitorConfig
 */
export function scheduleAsText(config: MonitorConfig) {
  // Crontab format uses cronstrue
  if (config.schedule_type === ScheduleType.CRONTAB) {
    const parsedSchedule = crontabAsText(config.schedule);
    return parsedSchedule ?? t('Unknown schedule');
  }

  if (config.schedule_type === ScheduleType.INTERVAL) {
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

    if (timeUnit === 'year') {
      return tn('Every year', 'Every %s years', value);
    }
  }

  return t('Unknown schedule');
}
