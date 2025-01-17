import {resetMockDate, setMockDate} from 'sentry-test/utils';

import type {MetricAggregation, MRI} from 'sentry/types/metrics';
import {
  getAbsoluteDateTimeRange,
  getDateTimeParams,
  getDefaultAggregation,
  getFormattedMQL,
  getMetricsInterval,
  isFormattedMQL,
} from 'sentry/utils/metrics';
import {DEFAULT_AGGREGATES} from 'sentry/utils/metrics/constants';

describe('getDDMInterval', () => {
  it('should return the correct interval for non-"1m" intervals', () => {
    const dateTimeObj = {start: '2023-01-01', end: '2023-01-31'};
    const useCase = 'sessions';

    const result = getMetricsInterval(dateTimeObj, useCase);

    expect(result).toBe('2h');
  });

  it('should return "10s" interval for "1m" interval within 60 minutes and custom use case', () => {
    const dateTimeObj = {
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-01T00:59:00.000Z',
    };
    const useCase = 'custom';

    const result = getMetricsInterval(dateTimeObj, useCase);

    expect(result).toBe('10s');
  });

  it('should return "1m" interval for "1m" interval beyond 60 minutes', () => {
    const dateTimeObj = {start: '2023-01-01', end: '2023-01-01T01:05:00.000Z'};
    const useCase = 'sessions';

    const result = getMetricsInterval(dateTimeObj, useCase);

    expect(result).toBe('1m');
  });
});

describe('getDateTimeParams', () => {
  it('should return the correct object with "statsPeriod" when period is provided', () => {
    const datetime = {start: '2023-01-01', end: '2023-01-31', period: '7d', utc: true};

    const result = getDateTimeParams(datetime);

    expect(result).toEqual({statsPeriod: '7d'});
  });

  it('should return the correct object with "start" and "end" when period is not provided', () => {
    const datetime = {start: '2023-01-01', end: '2023-01-31', period: null, utc: true};
    const result = getDateTimeParams(datetime);

    expect(result).toEqual({
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-31T00:00:00.000Z',
    });
  });
});

describe('getFormattedMQL', () => {
  it('should format metric widget object into a string', () => {
    const result = getFormattedMQL({
      aggregation: 'avg',
      mri: 'd:custom/sentry.process_profile.symbolicate.process@second',
      groupBy: ['result'],
      query: 'result:success',
    });

    expect(result).toBe(
      'avg(sentry.process_profile.symbolicate.process){result:success} by result'
    );
  });

  it('defaults to an empty string', () => {
    const result = getFormattedMQL({
      aggregation: '' as MetricAggregation,
      mri: 'd:custom/sentry.process_profile.symbolicate.process@second',
      groupBy: [],
      query: '',
    });

    expect(result).toBe('');
  });
});

describe('isFormattedMQL', () => {
  it('should return true for a valid MQL string - simple', () => {
    const result = isFormattedMQL('avg(sentry.process_profile.symbolicate.process)');

    expect(result).toBe(true);
  });
  it('should return true for a valid MQL string - filter', () => {
    const result = isFormattedMQL(
      'avg(sentry.process_profile.symbolicate.process){result:success}'
    );

    expect(result).toBe(true);
  });
  it('should return true for a valid MQL string - groupy by', () => {
    const result = isFormattedMQL(
      'avg(sentry.process_profile.symbolicate.process) by result'
    );

    expect(result).toBe(true);
  });
  it('should return true for a valid MQL string - filter and group by', () => {
    const result = isFormattedMQL(
      'avg(sentry.process_profile.symbolicate.process){result:success} by result'
    );

    expect(result).toBe(true);
  });

  it('should return false for an invalid MQL string', () => {
    const result = isFormattedMQL('not MQL string');

    expect(result).toBe(false);
  });
});

describe('getAbsoluteDateTimeRange', () => {
  beforeEach(() => {
    setMockDate(new Date('2024-01-01T00:00:00Z'));
  });
  afterEach(() => {
    resetMockDate();
  });

  it('should return the correct object with "start" and "end" when period is not provided', () => {
    const datetime = {
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-01T00:00:00.000Z',
      period: null,
      utc: true,
    };
    const result = getAbsoluteDateTimeRange(datetime);

    expect(result).toEqual({
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-01T00:00:00.000Z',
    });
  });

  it('should return the correct object with "start" and "end" when period is provided', () => {
    const datetime = {start: null, end: null, period: '7d', utc: true};
    const result = getAbsoluteDateTimeRange(datetime);

    expect(result).toEqual({
      start: '2023-12-25T00:00:00.000Z',
      end: '2024-01-01T00:00:00.000Z',
    });
  });
});

describe('getDefaultAggregation', () => {
  it.each(['c', 'd', 'g', 's'] as const)(
    'should give default aggregation - metric type %s',
    metricType => {
      const mri = `${metricType}:custom/xyz@test` as const;

      expect(getDefaultAggregation(mri)).toBe(DEFAULT_AGGREGATES[metricType]);
    }
  );

  it('should fallback to sum', () => {
    expect(getDefaultAggregation('b:roken/MRI@none' as MRI)).toBe('sum');
  });
});
