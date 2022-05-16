import MockDate from 'mockdate';
import moment from 'moment';

import {buildIncidentGraphDateRange} from 'sentry/views/alerts/rules/details/utils';

describe('buildIncidentGraphDateRange', () => {
  const now = '2022-05-16T20:00:00';
  beforeAll(() => {
    MockDate.set(`${now}Z`);
  });
  afterAll(() => {
    // reset mock date
    MockDate.set(new Date(1508208080000));
  });

  it('should use current date for an active alert', () => {
    const incident = TestStubs.Incident({
      dateClosed: null,
      dateStarted: '2022-05-16T18:55:00Z',
      timeWindow: {timeWindow: 1},
    });
    const result = buildIncidentGraphDateRange(incident);
    expect(result).toEqual({start: '2022-05-13T15:55:00', end: now});
    expect(moment(result.end).diff(moment(result.start), 'minutes')).toBe(4565);
  });

  it('should use current date for a recently closed alert', () => {
    const incident = TestStubs.Incident({
      dateClosed: '2022-05-16T18:57:00Z',
      dateStarted: '2022-05-16T18:55:00Z',
      timeWindow: {timeWindow: 1},
    });
    const result = buildIncidentGraphDateRange(incident);
    expect(result).toEqual({start: '2022-05-13T15:55:00', end: now});
    expect(moment(result.end).diff(moment(result.start), 'minutes')).toBe(4565);
  });

  it('should use a past date for an older alert', () => {
    // Incident is from over a week ago
    const incident = TestStubs.Incident({
      dateClosed: '2022-05-04T18:57:00Z',
      dateStarted: '2022-05-04T18:55:00Z',
      timeWindow: {timeWindow: 1},
    });
    const result = buildIncidentGraphDateRange(incident);
    expect(result).toEqual({start: '2022-05-01T15:55:00', end: '2022-05-07T21:57:00'});
    expect(moment(result.end).diff(moment(result.start), 'minutes')).toBe(9002);
  });

  it('should handle large time windows', () => {
    const incident = TestStubs.Incident({
      dateClosed: null,
      dateStarted: '2022-04-20T20:28:00Z',
      // 1 day time window
      timeWindow: {timeWindow: 1440},
    });
    const result = buildIncidentGraphDateRange(incident);
    expect(result).toEqual({start: '2022-04-07T20:42:00', end: now});
    expect(moment(result.end).diff(moment(result.start), 'days')).toBe(38);
  });
});
