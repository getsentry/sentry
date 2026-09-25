import type {LineSeriesOption} from 'echarts';
import ReactEchartsCore from 'echarts-for-react/lib/core';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render} from 'sentry-test/reactTestingLibrary';

import {Area} from './plottables/area';
import {Line} from './plottables/line';
import {TimeSeriesWidgetVisualization} from './timeSeriesWidgetVisualization';

// ECharts is stubbed globally; inspect the options passed to that boundary.
const chartRender = jest.spyOn(ReactEchartsCore.prototype, 'render');

function getChartSeries() {
  const chart = chartRender.mock.contexts.at(-1) as ReactEchartsCore;
  return chart.props.option.series as LineSeriesOption[];
}

describe('TimeSeriesWidgetVisualization area ordering', () => {
  it.each([false, true])(
    'keeps segments in stable draw order across legend changes (dual axis: %s)',
    dualAxis => {
      const timeSeries = TimeSeriesFixture({
        values: [
          {timestamp: 1729796400000, value: 10},
          {timestamp: 1729798200000, value: 20, incomplete: true},
        ],
      });
      const first = new Area(timeSeries, {name: 'first'});
      const second = new Area(
        TimeSeriesFixture({
          ...timeSeries,
          meta: dualAxis
            ? {...timeSeries.meta, valueType: 'integer', valueUnit: null}
            : timeSeries.meta,
        }),
        {name: 'second'}
      );
      const line = new Line(timeSeries, {name: 'line'});
      const plottables = [first, second, line];
      const {rerender} = render(
        <TimeSeriesWidgetVisualization plottables={plottables} />
      );

      const series = getChartSeries();
      expect(series).toHaveLength(6);
      expect(series.slice(0, 4).map(item => item.yAxisIndex)).toEqual(
        dualAxis ? [0, 0, 1, 1] : [0, 0, 0, 0]
      );
      const order = series.map(item => item.z);
      expect(order[0]).toBe(order[1]);
      expect(order[2]).toBe(order[3]);
      expect(order[0]).toBeGreaterThanOrEqual(3);
      if (dualAxis) {
        expect(order[0]).toBeGreaterThan(order[2]!);
      } else {
        expect(order[2]).toBeGreaterThan(order[0]!);
      }
      expect(order[2]).toBeLessThan(4);
      expect(order.slice(4)).toEqual([undefined, undefined]);
      expect(series[1]!.lineStyle?.type).toBe('dotted');
      expect(series[3]!.lineStyle?.type).toBe('dotted');

      for (const selected of [false, true]) {
        rerender(
          <TimeSeriesWidgetVisualization
            plottables={plottables}
            legendSelection={{first: selected}}
          />
        );
        expect(getChartSeries().map(item => item.z)).toEqual(order);
      }
    }
  );

  it('draws the entire primary stack above the secondary stack, preserving order within each', () => {
    const primary = TimeSeriesFixture({
      values: [
        {timestamp: 1729796400000, value: 10},
        {timestamp: 1729798200000, value: 20, incomplete: true},
      ],
    });
    const secondary = TimeSeriesFixture({
      ...primary,
      meta: {...primary.meta, valueType: 'integer', valueUnit: null},
    });
    const plottables = [
      new Area(primary, {name: 'success'}),
      new Area(secondary, {name: 'count'}),
      new Line(primary, {name: 'line'}),
      new Area(primary, {name: 'failure'}),
      new Area(secondary, {name: 'other count'}),
    ];
    const {rerender} = render(<TimeSeriesWidgetVisualization plottables={plottables} />);
    const series = getChartSeries();
    expect(series.map(item => item.yAxisIndex)).toEqual([0, 0, 1, 1, 0, 0, 0, 0, 1, 1]);
    const order = series.map(item => item.z);
    expect(order[6]).toBeGreaterThan(order[0]!);
    expect(order[0]).toBeGreaterThan(order[8]!);
    expect(order[8]).toBeGreaterThan(order[2]!);
    expect(order.slice(4, 6)).toEqual([undefined, undefined]);
    for (const index of [0, 2, 6, 8]) {
      expect(order[index]).toBe(order[index + 1]);
      expect(order[index]).toBeGreaterThanOrEqual(3);
      expect(order[index]).toBeLessThan(4);
    }

    for (const name of ['success', 'count', 'failure', 'other count']) {
      for (const selected of [false, true]) {
        rerender(
          <TimeSeriesWidgetVisualization
            plottables={plottables}
            legendSelection={{[name]: selected}}
          />
        );
        expect(getChartSeries().map(item => item.z)).toEqual(order);
      }
    }
  });
});
