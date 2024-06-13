import type {MonitorConfig} from '../types';
import {ScheduleType} from '../types';

import {scheduleAsText} from './scheduleAsText';

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
