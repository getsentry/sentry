import MockDate from 'mockdate';
import moment from 'moment';
import {Incident as IncidentFixture} from 'sentry-fixture/incident';
import {MetricRule as MetricRuleFixture} from 'sentry-fixture/metricRule';

import {buildMetricGraphDateRange} from 'sentry/views/alerts/rules/metric/details/utils';

describe('buildMetricGraphDateRange', () => {
  const now = '2022-05-16T20:00:00';
  beforeAll(() => {
    MockDate.set(`${now}Z`);
  });
  afterAll(() => {
    // reset mock date
    MockDate.set(new Date(1508208080000));
  });

  it('should use current date for an active alert', () => {
    const incident = IncidentFixture({
      dateStarted: '2022-05-16T18:55:00Z',
      dateClosed: null,
      alertRule: MetricRuleFixture({timeWindow: 1}),
    });
    const result = buildMetricGraphDateRange(incident);
    expect(result).toEqual({start: '2022-05-16T17:40:00', end: now});
    expect(moment(result.end).diff(moment(result.start), 'minutes')).toBe(140);
  });

  it('should use current date for a recently closed alert', () => {
    const incident = IncidentFixture({
      dateStarted: '2022-05-16T18:55:00Z',
      dateClosed: '2022-05-16T18:57:00Z',
      alertRule: MetricRuleFixture({timeWindow: 1}),
    });
    const result = buildMetricGraphDateRange(incident);
    expect(result).toEqual({start: '2022-05-16T17:40:00', end: now});
    expect(moment(result.end).diff(moment(result.start), 'minutes')).toBe(140);
  });

  it('should use a past date for an older alert', () => {
    // Incident is from over a week ago
    const incident = IncidentFixture({
      dateStarted: '2022-05-04T18:55:00Z',
      dateClosed: '2022-05-04T18:57:00Z',
      alertRule: MetricRuleFixture({timeWindow: 1}),
    });
    const result = buildMetricGraphDateRange(incident);
    expect(result).toEqual({end: '2022-05-04T20:12:00', start: '2022-05-04T17:40:00'});
    expect(moment(result.end).diff(moment(result.start), 'minutes')).toBe(152);
  });

  it('should handle large time windows', () => {
    const incident = IncidentFixture({
      dateStarted: '2022-04-20T20:28:00Z',
      dateClosed: null,
      // 1 day time window
      alertRule: MetricRuleFixture({timeWindow: 1440}),
    });
    const result = buildMetricGraphDateRange(incident);
    expect(result).toEqual({start: '2022-02-04T20:28:00', end: now});
    expect(moment(result.end).diff(moment(result.start), 'days')).toBe(100);
  });
});
