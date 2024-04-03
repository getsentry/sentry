import {resetMockDate, setMockDate} from 'sentry-test/utils';

import type {MetricsOperation} from 'sentry/types';
import {
  getAbsoluteDateTimeRange,
  getDateTimeParams,
  getDDMInterval,
  getFormattedMQL,
  isFormattedMQL,
} from 'sentry/utils/metrics';

describe('getDDMInterval', () => {
  it('should return the correct interval for non-"1m" intervals', () => {
    const dateTimeObj = {start: '2023-01-01', end: '2023-01-31'};
    const useCase = 'sessions';

    const result = getDDMInterval(dateTimeObj, useCase);

    expect(result).toBe('2h');
  });

  it('should return "10s" interval for "1m" interval within 60 minutes and custom use case', () => {
    const dateTimeObj = {
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-01T00:59:00.000Z',
    };
    const useCase = 'custom';

    const result = getDDMInterval(dateTimeObj, useCase);

    expect(result).toBe('10s');
  });

  it('should return "1m" interval for "1m" interval beyond 60 minutes', () => {
    const dateTimeObj = {start: '2023-01-01', end: '2023-01-01T01:05:00.000Z'};
    const useCase = 'sessions';

    const result = getDDMInterval(dateTimeObj, useCase);

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
      op: 'avg',
      mri: 'd:custom/sentry.process_profile.symbolicate.process@second',
      groupBy: ['result'],
      query: 'result:success',
    });

    expect(result).toEqual(
      'avg(sentry.process_profile.symbolicate.process){result:success} by result'
    );
  });

  it('defaults to an empty string', () => {
    const result = getFormattedMQL({
      op: '' as MetricsOperation,
      mri: 'd:custom/sentry.process_profile.symbolicate.process@second',
      groupBy: [],
      query: '',
    });

    expect(result).toEqual('');
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
