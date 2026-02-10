import {transformLegacySeriesToTimeSeries} from './transformLegacySeriesToTimeSeries';

describe('transformLegacySeriesToTimeSeries', () => {
  it('returns null for undefined series', () => {
    expect(transformLegacySeriesToTimeSeries(undefined, undefined, undefined)).toBeNull();
  });

  it('transforms series data correctly', () => {
    const series = {
      seriesName: 'count()',
      data: [
        {name: 1729796400000, value: 100},
        {name: 1729800000000, value: 200},
      ],
    };

    const timeSeries = transformLegacySeriesToTimeSeries(
      series,
      undefined,
      undefined,
      [],
      'count()'
    );

    expect(timeSeries).not.toBeNull();
    expect(timeSeries!.yAxis).toBe('count()');
    expect(timeSeries!.values).toHaveLength(2);
    expect(timeSeries!.values[0]).toMatchObject({timestamp: 1729796400000, value: 100});
    expect(timeSeries!.values[1]).toMatchObject({timestamp: 1729800000000, value: 200});
    expect(timeSeries!.meta.valueType).toBe('number');
  });

  it('handles alias series names', () => {
    const series = {
      seriesName: 'my_alias : epm()',
      data: [
        {name: 1729796400000, value: 100},
        {name: 1729800000000, value: 200},
      ],
    };

    const timeSeries = transformLegacySeriesToTimeSeries(
      series,
      undefined,
      undefined,
      [],
      'epm()'
    );

    expect(timeSeries).not.toBeNull();
    expect(timeSeries!.meta.valueUnit).toBe('1/minute');
  });

  it('sets isOther to true for "Other" series', () => {
    const otherSeries = {
      seriesName: 'Other',
      data: [{name: 1729796400000, value: 100}],
    };
    const aliasedOtherSeries = {
      seriesName: 'count() : Other',
      data: [{name: 1729796400000, value: 100}],
    };
    const regularSeries = {
      seriesName: 'count()',
      data: [{name: 1729796400000, value: 100}],
    };

    expect(
      transformLegacySeriesToTimeSeries(otherSeries, undefined, undefined, [], 'count()')!
        .meta.isOther
    ).toBe(true);
    expect(
      transformLegacySeriesToTimeSeries(
        aliasedOtherSeries,
        undefined,
        undefined,
        [],
        'count()'
      )!.meta.isOther
    ).toBe(true);
    expect(
      transformLegacySeriesToTimeSeries(
        regularSeries,
        undefined,
        undefined,
        [],
        'count()'
      )!.meta.isOther
    ).toBe(false);
  });

  it('parses groupBy from series name when groupByFields provided', () => {
    const series = {
      seriesName: 'count() : /api/users,db',
      data: [{name: 1729796400000, value: 100}],
    };

    const timeSeries = transformLegacySeriesToTimeSeries(
      series,
      undefined,
      undefined,
      ['transaction', 'span.op'],
      'count()'
    );

    expect(timeSeries!.yAxis).toBe('count()');
    expect(timeSeries!.groupBy).toEqual([
      {key: 'transaction', value: '/api/users'},
      {key: 'span.op', value: 'db'},
    ]);
  });

  it('returns null groupBy for "Other" series', () => {
    const series = {
      seriesName: 'count() : Other',
      data: [{name: 1729796400000, value: 100}],
    };

    const timeSeries = transformLegacySeriesToTimeSeries(
      series,
      undefined,
      undefined,
      ['transaction'],
      'count()'
    );

    expect(timeSeries!.groupBy).toBeNull();
    expect(timeSeries!.meta.isOther).toBe(true);
  });

  it('returns null groupBy when no groupByFields provided', () => {
    const series = {
      seriesName: 'count()',
      data: [{name: 1729796400000, value: 100}],
    };

    const timeSeries = transformLegacySeriesToTimeSeries(
      series,
      undefined,
      undefined,
      [],
      'count()'
    );

    expect(timeSeries!.groupBy).toBeNull();
  });

  it('transforms session series data correctly', () => {
    const erroredRateSeries = {
      seriesName: 'errored_rate(session)',
      data: [
        {name: 172979640, value: 100},
        {name: 172980000, value: 200},
      ],
    };
    const sumSessionSeries = {
      seriesName: 'sum(session)',
      data: [
        {name: 172979640, value: 300},
        {name: 172980000, value: 400},
      ],
    };

    const erroredRateTimeSeries = transformLegacySeriesToTimeSeries(
      erroredRateSeries,
      undefined,
      undefined,
      [],
      'errored_rate(session)'
    );
    const sumSessionTimeSeries = transformLegacySeriesToTimeSeries(
      sumSessionSeries,
      undefined,
      undefined,
      [],
      'sum(session)'
    );

    expect(erroredRateTimeSeries!.yAxis).toBe('errored_rate(session)');
    expect(sumSessionTimeSeries!.yAxis).toBe('sum(session)');
    expect(erroredRateTimeSeries!.values).toHaveLength(2);
    expect(erroredRateTimeSeries!.values[0]).toMatchObject({
      timestamp: 172979640,
      value: 100,
    });
    expect(erroredRateTimeSeries!.values[1]).toMatchObject({
      timestamp: 172980000,
      value: 200,
    });
    expect(sumSessionTimeSeries!.values).toHaveLength(2);
    expect(sumSessionTimeSeries!.values[0]).toMatchObject({
      timestamp: 172979640,
      value: 300,
    });
    expect(sumSessionTimeSeries!.values[1]).toMatchObject({
      timestamp: 172980000,
      value: 400,
    });
    expect(erroredRateTimeSeries!.meta.valueType).toBe('percentage');
    expect(sumSessionTimeSeries!.meta.valueType).toBe('number');
    expect(erroredRateTimeSeries!.meta.interval).toBe(360);
    expect(sumSessionTimeSeries!.meta.interval).toBe(360);
  });
});
