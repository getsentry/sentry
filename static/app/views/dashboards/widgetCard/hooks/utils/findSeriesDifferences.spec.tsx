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

  it('reports value, length and naming differences', () => {
    expect(
      findSeriesDifferences(
        [
          makeSeries('count()', [100, 200, 300, 400]),
          makeSeries('p50(span.duration)', [1, 2, 3]),
          makeSeries('chrome : count()', [1, 2, 3]),
        ],
        [
          makeSeries('count()', [100, 150, 300, 400]),
          makeSeries('p50(span.duration)', [1, 2]),
          makeSeries('Chrome : count()', [1, 2, 3]),
        ]
      )
    ).toEqual([
      {reason: 'value'},
      {reason: 'length'},
      {reason: 'unmatchedSeries'},
      {reason: 'unmatchedSeries'},
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

    expect(findSeriesDifferences([legacy], [shifted])).toEqual([{reason: 'timestamp'}]);
  });

  it('falls back to a deep comparison for other differences', () => {
    const countSeries = makeSeries('count()', [100, 200, 300]);
    const p50Series = makeSeries('p50(span.duration)', [1, 2, 3]);

    expect(
      findSeriesDifferences([countSeries, p50Series], [p50Series, countSeries])
    ).toEqual([{reason: 'other'}]);
  });
});
