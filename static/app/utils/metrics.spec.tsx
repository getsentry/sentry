import {formatMetricsUsingUnitAndOp, parseMRI} from 'sentry/utils/metrics';

describe('parseMRI', () => {
  it('should handle falsy values', () => {
    expect(parseMRI('')).toEqual(null);
    expect(parseMRI(undefined)).toEqual(null);
  });

  it('should parse MRI with name, unit, and mri (custom use case)', () => {
    const mri = 'd:custom/sentry.events.symbolicator.query_task@second';
    const expectedResult = {
      name: 'sentry.events.symbolicator.query_task',
      unit: 'second',
      mri: 'd:custom/sentry.events.symbolicator.query_task@second',
      useCase: 'custom',
    };
    expect(parseMRI(mri)).toEqual(expectedResult);
  });

  it('should parse MRI with name, unit, and cleanMRI (transactions use case)', () => {
    const mri = 'g:transactions/gauge@milisecond';
    const expectedResult = {
      name: 'gauge',
      unit: 'milisecond',
      mri: 'g:transactions/gauge@milisecond',
      useCase: 'transactions',
    };
    expect(parseMRI(mri)).toEqual(expectedResult);
  });

  it('should parse MRI with name, unit, and cleanMRI (sessions use case)', () => {
    const mri = 'd:sessions/sentry.events.symbolicator.query_task@week';
    const expectedResult = {
      name: 'sentry.events.symbolicator.query_task',
      unit: 'week',
      mri: 'd:sessions/sentry.events.symbolicator.query_task@week',
      useCase: 'sessions',
    };
    expect(parseMRI(mri)).toEqual(expectedResult);
  });

  it('should extract MRI from nested operations', () => {
    const mri = 'd:custom/foobar@none';

    const expectedResult = {
      name: 'foobar',
      unit: 'none',
      mri: 'd:custom/foobar@none',
      useCase: 'custom',
    };
    expect(parseMRI(`sum(avg(${mri}))`)).toEqual(expectedResult);
  });

  it('should extract MRI from nested operations (set)', () => {
    const mri = 's:custom/foobar@none';

    const expectedResult = {
      name: 'foobar',
      unit: 'none',
      mri: 's:custom/foobar@none',
      useCase: 'custom',
    };
    expect(parseMRI(`count_unique(${mri})`)).toEqual(expectedResult);
  });
});

describe('formatMetricsUsingUnitAndOp', () => {
  it('should format the value according to the unit', () => {
    // Test cases for different units
    expect(formatMetricsUsingUnitAndOp(123456, 'millisecond')).toEqual('2.06min');
    expect(formatMetricsUsingUnitAndOp(5000, 'second')).toEqual('1.39hr');
    expect(formatMetricsUsingUnitAndOp(600, 'byte')).toEqual('600 B');
    expect(formatMetricsUsingUnitAndOp(4096, 'kibibyte')).toEqual('4.0 MiB');
    expect(formatMetricsUsingUnitAndOp(3145728, 'megabyte')).toEqual('3.15 TB');
  });

  it('should handle value as null', () => {
    expect(formatMetricsUsingUnitAndOp(null, 'millisecond')).toEqual('—');
    expect(formatMetricsUsingUnitAndOp(null, 'byte')).toEqual('—');
    expect(formatMetricsUsingUnitAndOp(null, 'megabyte')).toEqual('—');
  });

  it('should format count operation as a number', () => {
    expect(formatMetricsUsingUnitAndOp(99, 'none', 'count')).toEqual('99');
    expect(formatMetricsUsingUnitAndOp(null, 'none', 'count')).toEqual('');
  });
});
