import type {CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams} from 'echarts';
import {ThemeFixture} from 'sentry-fixture/theme';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import type {TimeSeriesItem} from 'sentry/views/dashboards/widgets/common/types';

import {Bars} from './plottables/bars';
import {Line} from './plottables/line';
import {Thresholds} from './plottables/thresholds';
import {
  createLowConfidenceBackgroundSeries,
  getLowConfidenceRanges,
} from './lowConfidenceBackground';

const INTERVAL = 1_000;
const HALF = INTERVAL / 2;

function makeLine(items: Array<Partial<TimeSeriesItem>>) {
  return new Line(
    TimeSeriesFixture({
      meta: {valueType: 'number', valueUnit: null, interval: INTERVAL},
      values: items.map((item, index) => ({
        timestamp: index * INTERVAL,
        value: 1,
        ...item,
      })),
    })
  );
}

const BOUNDS = {start: 0, end: 9 * INTERVAL};

describe('getLowConfidenceRanges', () => {
  it('covers half an interval either side of each low confidence bucket', () => {
    const line = makeLine([
      {},
      {},
      {confidence: 'low'},
      {},
      {},
      {confidence: 'low'},
      {},
      {},
      {},
      {},
    ]);

    expect(getLowConfidenceRanges([line], BOUNDS)).toEqual([
      {start: 2 * INTERVAL - HALF, end: 2 * INTERVAL + HALF},
      {start: 5 * INTERVAL - HALF, end: 5 * INTERVAL + HALF},
    ]);
  });

  it('merges consecutive low confidence buckets into one range', () => {
    const line = makeLine([
      {},
      {confidence: 'low'},
      {confidence: 'low'},
      {confidence: 'low'},
      {},
    ]);

    expect(getLowConfidenceRanges([line], BOUNDS)).toEqual([
      {start: INTERVAL - HALF, end: 3 * INTERVAL + HALF},
    ]);
  });

  it('merges ranges from every plottable', () => {
    const first = makeLine([{}, {confidence: 'low'}, {}, {}, {}, {}]);
    const second = new Bars(
      makeLine([{}, {}, {confidence: 'low'}, {}, {}, {confidence: 'low'}]).timeSeries
    );

    expect(getLowConfidenceRanges([first, second], BOUNDS)).toEqual([
      {start: INTERVAL - HALF, end: 2 * INTERVAL + HALF},
      {start: 5 * INTERVAL - HALF, end: 5 * INTERVAL + HALF},
    ]);
  });

  it('clamps ranges to the chart bounds', () => {
    const line = makeLine([{confidence: 'low'}, {}, {confidence: 'low'}]);

    expect(getLowConfidenceRanges([line], {start: 0, end: 2 * INTERVAL})).toEqual([
      {start: 0, end: HALF},
      {start: 2 * INTERVAL - HALF, end: 2 * INTERVAL},
    ]);
  });

  it('ignores high, null, empty, and incomplete buckets', () => {
    const line = makeLine([
      {confidence: 'high'},
      {confidence: null},
      {confidence: 'low', value: null},
      {confidence: 'low', incomplete: true},
    ]);

    expect(getLowConfidenceRanges([line], BOUNDS)).toEqual([]);
  });

  it('ignores plottables that are not time series', () => {
    const thresholds = new Thresholds({
      thresholds: {max_values: {max1: 10, max2: 20}, unit: null},
    });

    expect(getLowConfidenceRanges([thresholds], BOUNDS)).toEqual([]);
  });
});

describe('createLowConfidenceBackgroundSeries', () => {
  const theme = ThemeFixture();

  it('hatches the full plot height behind each range', () => {
    const series = createLowConfidenceBackgroundSeries(
      [{start: 1_000, end: 3_000}],
      theme
    );

    expect(series).toEqual(
      expect.objectContaining({
        data: [[1_000, 3_000]],
        encode: {x: [0, 1]},
        silent: true,
        tooltip: {show: false},
        z: 1,
      })
    );

    const renderItem = series.renderItem!;
    const element = renderItem(
      {
        dataIndex: 0,
        coordSys: {type: 'cartesian2d', x: 0, y: 10, width: 500, height: 200},
      } as unknown as CustomSeriesRenderItemParams,
      {
        coord: ([time]: number[]) => [(time ?? 0) / 10, 0],
      } as unknown as CustomSeriesRenderItemAPI
    );

    expect(element).toEqual(
      expect.objectContaining({
        type: 'rect',
        shape: {x: 100, y: 10, width: 200, height: 200},
        style: expect.objectContaining({
          decal: expect.objectContaining({color: theme.tokens.background.tertiary}),
        }),
      })
    );
  });
});
