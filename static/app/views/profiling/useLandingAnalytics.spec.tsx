import {deriveFinalDataState} from './useLandingAnalytics';

describe('deriveFinalDataState', function () {
  it.each([
    {
      flamegraphData: 'populated' as const,
      transactionsTableData: 'pending' as const,
      widget1Data: 'pending' as const,
      widget2Data: 'pending' as const,
    },
    {
      flamegraphData: 'pending' as const,
      transactionsTableData: 'populated' as const,
      widget1Data: 'pending' as const,
      widget2Data: 'pending' as const,
    },
    {
      flamegraphData: 'pending' as const,
      transactionsTableData: 'pending' as const,
      widget1Data: 'populated' as const,
      widget2Data: 'pending' as const,
    },
    {
      flamegraphData: 'pending' as const,
      transactionsTableData: 'pending' as const,
      widget1Data: 'pending' as const,
      widget2Data: 'populated' as const,
    },
  ])('any populated %s', function (dataLoaded) {
    const dataState = deriveFinalDataState(dataLoaded);
    expect(dataState).toBe('populated');
  });

  it.each([
    {
      flamegraphData: 'loading' as const,
      transactionsTableData: 'loading' as const,
      widget1Data: 'loading' as const,
      widget2Data: 'loading' as const,
    },
    {
      flamegraphData: 'loading' as const,
      transactionsTableData: 'errored' as const,
      widget1Data: 'errored' as const,
      widget2Data: 'errored' as const,
    },
    {
      flamegraphData: 'errored' as const,
      transactionsTableData: 'loading' as const,
      widget1Data: 'errored' as const,
      widget2Data: 'errored' as const,
    },
    {
      flamegraphData: 'errored' as const,
      transactionsTableData: 'errored' as const,
      widget1Data: 'loading' as const,
      widget2Data: 'errored' as const,
    },
    {
      flamegraphData: 'errored' as const,
      transactionsTableData: 'errored' as const,
      widget1Data: 'errored' as const,
      widget2Data: 'loading' as const,
    },
  ])('none populated but some loading %s', function (dataLoaded) {
    const dataState = deriveFinalDataState(dataLoaded);
    expect(dataState).toBe('loading');
  });

  it('all pending', function () {
    const dataState = deriveFinalDataState({
      flamegraphData: 'pending' as const,
      transactionsTableData: 'pending' as const,
      widget1Data: 'pending' as const,
      widget2Data: 'pending' as const,
    });
    expect(dataState).toBe('pending');
  });

  it('all errored', function () {
    const dataState = deriveFinalDataState({
      flamegraphData: 'errored' as const,
      transactionsTableData: 'errored' as const,
      widget1Data: 'errored' as const,
      widget2Data: 'errored' as const,
    });
    expect(dataState).toBe('errored');
  });

  it.each([
    {
      flamegraphData: 'empty' as const,
      transactionsTableData: 'empty' as const,
      widget1Data: 'empty' as const,
      widget2Data: 'empty' as const,
    },
    {
      flamegraphData: 'errored' as const,
      transactionsTableData: 'empty' as const,
      widget1Data: 'empty' as const,
      widget2Data: 'empty' as const,
    },
    {
      flamegraphData: 'empty' as const,
      transactionsTableData: 'errored' as const,
      widget1Data: 'empty' as const,
      widget2Data: 'empty' as const,
    },
    {
      flamegraphData: 'empty' as const,
      transactionsTableData: 'empty' as const,
      widget1Data: 'errored' as const,
      widget2Data: 'empty' as const,
    },
    {
      flamegraphData: 'empty' as const,
      transactionsTableData: 'empty' as const,
      widget1Data: 'empty' as const,
      widget2Data: 'errored' as const,
    },
  ])('all empty or errored', function (dataLoaded) {
    const dataState = deriveFinalDataState(dataLoaded);
    expect(dataState).toBe('empty');
  });
});
