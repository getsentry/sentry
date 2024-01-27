import {shouldUse24Hours} from 'sentry/utils/dates';

import type {MonitorConfig} from './types';
import {ScheduleType} from './types';
import {crontabAsText, scheduleAsText} from './utils';

jest.mock('sentry/utils/dates');

describe('crontabAsText', function () {
  beforeEach(() => {
    jest.mocked(shouldUse24Hours).mockReturnValue(false);
  });

  it('translates simple crontab', function () {
    expect(crontabAsText('* * * * *')).toBe('Every minute');
    expect(crontabAsText('10 * * * *')).toBe('At 10 minutes past the hour');
  });

  it('handles 24 hour clock', function () {
    expect(crontabAsText('0 5/* * 1-5 *')).toBe(
      'At 0 minutes past the hour, every * hours, starting at 05:00 AM, January through May'
    );

    jest.mocked(shouldUse24Hours).mockReturnValue(true);

    expect(crontabAsText('0 5/* * 1-5 *')).toBe(
      'At 0 minutes past the hour, every * hours, starting at 05:00, January through May'
    );
  });
});

describe('scheduleAsText', function () {
  it('uses crontabAsText', function () {
    const config: MonitorConfig = {
      checkin_margin: 0,
      max_runtime: 0,
      timezone: 'utc',
      schedule_type: ScheduleType.CRONTAB,
      schedule: '10 * * * *',
    };
    expect(scheduleAsText(config)).toBe('At 10 minutes past the hour');
  });

  it('translates interval conigs', function () {
    const config: MonitorConfig = {
      checkin_margin: 0,
      max_runtime: 0,
      timezone: 'utc',
      schedule_type: ScheduleType.INTERVAL,
      schedule: [1, 'minute'],
    };

    expect(scheduleAsText({...config, schedule: [1, 'minute']})).toBe('Every minute');
    expect(scheduleAsText({...config, schedule: [1, 'hour']})).toBe('Every hour');
    expect(scheduleAsText({...config, schedule: [1, 'day']})).toBe('Every day');
    expect(scheduleAsText({...config, schedule: [1, 'week']})).toBe('Every week');
    expect(scheduleAsText({...config, schedule: [1, 'month']})).toBe('Every month');
    expect(scheduleAsText({...config, schedule: [1, 'year']})).toBe('Every year');

    expect(scheduleAsText({...config, schedule: [5, 'minute']})).toBe('Every 5 minutes');
    expect(scheduleAsText({...config, schedule: [5, 'hour']})).toBe('Every 5 hours');
    expect(scheduleAsText({...config, schedule: [5, 'day']})).toBe('Every 5 days');
    expect(scheduleAsText({...config, schedule: [5, 'week']})).toBe('Every 5 weeks');
    expect(scheduleAsText({...config, schedule: [5, 'month']})).toBe('Every 5 months');
    expect(scheduleAsText({...config, schedule: [5, 'year']})).toBe('Every 5 years');
  });
});
