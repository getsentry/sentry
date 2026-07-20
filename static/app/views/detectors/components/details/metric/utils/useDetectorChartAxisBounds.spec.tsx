import {renderHook} from 'sentry-test/reactTestingLibrary';

import type {Series} from 'sentry/types/echarts';
import {useDetectorChartAxisBounds} from 'sentry/views/detectors/components/details/metric/utils/useDetectorChartAxisBounds';

function makeSeries(values: number[]): Series {
  return {
    seriesName: 'test',
    data: values.map((value, i) => ({name: i, value})),
  };
}

describe('useDetectorChartAxisBounds', () => {
  it('anchors the min at 0 and pads the max for non-percentage metrics', () => {
    const {result} = renderHook(() =>
      useDetectorChartAxisBounds({
        series: [makeSeries([450, 500, 550])],
        thresholdMaxValue: 300,
        aggregate: 'count()',
      })
    );

    // min is anchored at 0 rather than zooming into the clustered data, max gets 10% padding
    expect(result.current).toEqual({minValue: 0, maxValue: 605});
  });

  it('uses the threshold as the max without padding when it exceeds the data', () => {
    const {result} = renderHook(() =>
      useDetectorChartAxisBounds({
        series: [makeSeries([100])],
        thresholdMaxValue: 200,
        aggregate: 'count()',
      })
    );

    // threshold is the ceiling, so it's used as-is so the threshold line sits at the top edge
    expect(result.current.maxValue).toBe(200);
  });

  it('zooms the min into the data range and caps the max at 1 for percentage metrics', () => {
    const {result} = renderHook(() =>
      useDetectorChartAxisBounds({
        series: [makeSeries([0.9, 0.95, 1])],
        thresholdMaxValue: 0.5,
        aggregate: 'failure_rate()',
      })
    );

    // min zooms to seriesMin - 10% padding, max is capped at 100%
    expect(result.current.minValue).toBeCloseTo(0.81);
    expect(result.current.maxValue).toBe(1);
  });
});
