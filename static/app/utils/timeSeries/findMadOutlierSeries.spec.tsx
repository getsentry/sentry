import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {DurationUnit} from 'sentry/utils/discover/fields';
import type {TimeSeriesItem} from 'sentry/views/dashboards/widgets/common/types';

import {findMadOutlierSeries} from './findMadOutlierSeries';

function makeSeries(
  name: string,
  values: Array<number | null | Partial<TimeSeriesItem>>,
  options: {isOther?: boolean} = {}
) {
  return TimeSeriesFixture({
    yAxis: 'p95(span.duration)',
    groupBy: [{key: 'transaction', value: name}],
    meta: {
      valueType: 'duration',
      valueUnit: DurationUnit.MILLISECOND,
      interval: 60_000,
      isOther: options.isOther,
    },
    values: values.map((value, index) => ({
      timestamp: index * 60_000,
      ...(typeof value === 'object' && value !== null ? value : {value}),
      value: typeof value === 'object' && value !== null ? (value.value ?? null) : value,
    })),
  });
}

describe('findMadOutlierSeries', () => {
  it('returns the series that strays furthest from the others', () => {
    const outlier = makeSeries('slow', [100, 110, 105]);
    const result = findMadOutlierSeries([
      makeSeries('a', [10, 11, 12]),
      makeSeries('b', [12, 10, 11]),
      outlier,
      makeSeries('c', [11, 12, 10]),
    ]);

    expect(result?.timeSeries).toBe(outlier);
    expect(result?.score).toBeGreaterThan(3);
  });

  it('needs at least three series that are not Other', () => {
    expect(
      findMadOutlierSeries([
        makeSeries('a', [10, 11]),
        makeSeries('b', [100, 110]),
        makeSeries('other', [1000, 1100], {isOther: true}),
      ])
    ).toBeNull();
  });

  it('never picks Other', () => {
    const result = findMadOutlierSeries([
      makeSeries('a', [10, 11]),
      makeSeries('b', [12, 10]),
      makeSeries('c', [30, 32]),
      makeSeries('other', [5000, 6000], {isOther: true}),
    ]);

    expect(result?.timeSeries.groupBy?.[0]?.value).toBe('c');
  });

  it('skips missing and incomplete values', () => {
    const result = findMadOutlierSeries([
      makeSeries('a', [10, 11]),
      makeSeries('b', [12, 10]),
      makeSeries('c', [11, {value: 9999, incomplete: true}]),
      makeSeries('d', [null, 12]),
    ]);

    // Every remaining timestamp has a value close to the others
    expect(result?.score).toBeLessThan(2);
  });

  describe('normalize', () => {
    const series = [
      // The busiest group keeps the same shape as the others
      makeSeries('busy', [10000, 11000, 10500, 10000]),
      makeSeries('a', [100, 110, 105, 100]),
      makeSeries('b', [200, 220, 210, 200]),
      // A quiet group that triples partway through
      makeSeries('spiky', [50, 50, 150, 150]),
    ];

    it('picks the biggest group when comparing raw values', () => {
      expect(findMadOutlierSeries(series)?.timeSeries.groupBy?.[0]?.value).toBe('busy');
    });

    it('picks the group whose shape differs when normalized', () => {
      expect(
        findMadOutlierSeries(series, {normalize: true})?.timeSeries.groupBy?.[0]?.value
      ).toBe('spiky');
    });

    it('scales mostly-zero series by their mean', () => {
      const sparse = makeSeries('sparse', [0, 0, 0, 40]);
      const result = findMadOutlierSeries(
        [
          makeSeries('a', [10, 10, 10, 10]),
          makeSeries('b', [20, 21, 20, 20]),
          makeSeries('c', [30, 30, 31, 30]),
          sparse,
        ],
        {normalize: true}
      );
      expect(result?.timeSeries).toBe(sparse);
    });

    it('leaves out series that are all zero', () => {
      expect(
        findMadOutlierSeries(
          [
            makeSeries('a', [10, 11]),
            makeSeries('b', [20, 21]),
            makeSeries('zero', [0, 0]),
          ],
          {normalize: true}
        )
      ).toBeNull();
    });
  });

  it('falls back to the mean absolute deviation when the MAD is zero', () => {
    const outlier = makeSeries('d', [50, 50]);
    const result = findMadOutlierSeries([
      makeSeries('a', [10, 10]),
      makeSeries('b', [10, 10]),
      makeSeries('c', [10, 10]),
      outlier,
    ]);
    expect(result?.timeSeries).toBe(outlier);
  });

  it('returns null when every value is the same', () => {
    expect(
      findMadOutlierSeries([
        makeSeries('a', [0, 0]),
        makeSeries('b', [0, 0]),
        makeSeries('c', [0, 0]),
      ])
    ).toBeNull();
  });
});
