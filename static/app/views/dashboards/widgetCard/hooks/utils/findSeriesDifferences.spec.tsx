import {findSeriesDifferences} from 'sentry/views/dashboards/widgetCard/hooks/utils/findSeriesDifferences';

const T0 = 1_700_000_000_000;

function makeSeries(seriesName: string, values: number[]) {
  return {
    seriesName,
    data: values.map((value, index) => ({
      name: T0 + index * 60_000,
      value,
    })),
  };
}

describe('findSeriesDifferences', () => {
  it('ignores small value drift and first and last bucket values', () => {
    expect(
      findSeriesDifferences(
        [makeSeries('count()', [100, 200, 300])],
        [makeSeries('count()', [999, 201, 999])]
      )
    ).toEqual([]);
  });

  it('does not report matching non-numeric values', () => {
    expect(
      findSeriesDifferences(
        [makeSeries('count()', [NaN, NaN, NaN])],
        [makeSeries('count()', [NaN, NaN, NaN])]
      )
    ).toEqual([]);
  });

  it('reports value, length and naming differences', () => {
    expect(
      findSeriesDifferences(
        [
          makeSeries('count()', [100, 200, 300, 400]),
          makeSeries('p50(span.duration)', [1, 2, 3, 4]),
          makeSeries('chrome : count()', [1, 2, 3]),
        ],
        [
          makeSeries('count()', [100, 150, 300, 400]),
          makeSeries('p50(span.duration)', [1, 2]),
          makeSeries('Chrome : count()', [1, 2, 3]),
        ]
      )
    ).toEqual([
      {reason: 'value', legacyValue: 200, timeSeriesValue: 150},
      {reason: 'length', legacyLength: 4, timeSeriesLength: 2},
      {reason: 'unmatchedLegacySeries'},
      {reason: 'unmatchedTimeSeries'},
    ]);
  });

  it('ignores one extra bucket at either end', () => {
    const legacy = makeSeries('count()', [100, 200, 300, 400]);
    const extraLeading = {
      ...legacy,
      data: [{name: T0 - 60_000, value: 50}, ...legacy.data],
    };
    const extraTrailing = {
      ...legacy,
      data: [...legacy.data, {name: T0 + 4 * 60_000, value: 50}],
    };

    expect(findSeriesDifferences([legacy], [extraLeading])).toEqual([]);
    expect(findSeriesDifferences([legacy], [extraTrailing])).toEqual([]);
    expect(findSeriesDifferences([extraLeading], [legacy])).toEqual([]);
    expect(findSeriesDifferences([extraTrailing], [legacy])).toEqual([]);
  });

  it('still compares values when lengths differ by one', () => {
    const legacy = makeSeries('count()', [100, 200, 300, 400]);
    const shifted = {
      ...legacy,
      data: [
        {name: T0 - 60_000, value: 50},
        ...makeSeries('count()', [100, 250, 300, 400]).data,
      ],
    };

    expect(findSeriesDifferences([legacy], [shifted])).toEqual([
      {reason: 'value', legacyValue: 200, timeSeriesValue: 250},
    ]);
  });

  it('reports mismatched timestamps', () => {
    const legacy = makeSeries('count()', [100, 200, 300]);
    const shifted = {
      ...legacy,
      data: legacy.data.map((item, index) =>
        index === 0 ? {...item, name: Number(item.name) + 1000} : item
      ),
    };

    expect(findSeriesDifferences([legacy], [shifted])).toEqual([
      {reason: 'timestamp', legacyTimestamp: T0, timeSeriesTimestamp: T0 + 1000},
    ]);
  });

  it('falls back to a deep comparison for other differences', () => {
    const countSeries = makeSeries('count()', [100, 200, 300]);
    const p50Series = makeSeries('p50(span.duration)', [1, 2, 3]);

    expect(
      findSeriesDifferences([countSeries, p50Series], [p50Series, countSeries])
    ).toEqual([{reason: 'other'}]);
  });
});
