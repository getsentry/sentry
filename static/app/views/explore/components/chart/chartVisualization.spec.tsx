import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {DurationUnit} from 'sentry/utils/discover/fields';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import type {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {useChartInfosPlottables} from 'sentry/views/explore/components/chart/chartVisualization';
import type {ChartInfo} from 'sentry/views/explore/components/chart/types';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import type {SortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

function durationSeries(yAxis: string, group?: string): TimeSeries {
  return TimeSeriesFixture({
    yAxis,
    meta: {
      valueType: 'duration',
      valueUnit: DurationUnit.MILLISECOND,
      interval: 1_800_000,
    },
    groupBy: group ? [{key: 'span.description', value: group}] : undefined,
  });
}

function chartInfoFixture(yAxis: string, series: TimeSeries[]): ChartInfo {
  return {
    chartType: ChartType.BAR,
    series,
    timeseriesResult: {} as SortedTimeSeries,
    yAxis,
  };
}

describe('useChartInfosPlottables', () => {
  it('keeps the default labels and a shared stack for a single aggregate', () => {
    const {result} = renderHookWithProviders(() =>
      useChartInfosPlottables([
        chartInfoFixture('p50(span.duration)', [
          durationSeries('p50(span.duration)', 'GET /a'),
          durationSeries('p50(span.duration)', 'GET /b'),
        ]),
      ])
    );

    const plottables = result.current as Bars[];
    expect(plottables.map(plottable => plottable.label)).toEqual(['GET /a', 'GET /b']);
    expect(plottables.map(plottable => plottable.config?.stack)).toEqual(['all', 'all']);
  });

  it('prefixes grouped labels and stacks per aggregate when combined', () => {
    const {result} = renderHookWithProviders(() =>
      useChartInfosPlottables([
        chartInfoFixture('p50(span.duration)', [
          durationSeries('p50(span.duration)', 'GET /a'),
        ]),
        chartInfoFixture('p99(span.duration)', [
          durationSeries('p99(span.duration)', 'GET /a'),
        ]),
      ])
    );

    const plottables = result.current as Bars[];
    expect(plottables.map(plottable => plottable.label)).toEqual([
      'p50(span.duration) : GET /a',
      'p99(span.duration) : GET /a',
    ]);
    expect(plottables.map(plottable => plottable.config?.stack)).toEqual([
      'p50(span.duration)',
      'p99(span.duration)',
    ]);
  });

  it('keeps aggregate labels for ungrouped series when combined', () => {
    const {result} = renderHookWithProviders(() =>
      useChartInfosPlottables([
        chartInfoFixture('p50(span.duration)', [durationSeries('p50(span.duration)')]),
        chartInfoFixture('p99(span.duration)', [durationSeries('p99(span.duration)')]),
      ])
    );

    expect(result.current.map(plottable => (plottable as Bars).label)).toEqual([
      'p50(span.duration)',
      'p99(span.duration)',
    ]);
  });
});
