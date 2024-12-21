import type {ComponentProps} from 'react';

import type {EChartHighlightHandler, Series} from 'sentry/types/echarts';
import {AVG_COLOR} from 'sentry/views/insights/colors';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {getDurationChartTitle} from 'sentry/views/insights/common/views/spans/types';
import {CHART_HEIGHT} from 'sentry/views/insights/http/settings';

interface Props {
  isLoading: boolean;
  series: Series[];
  error?: Error | null;
  onHighlight?: (highlights: Highlight[], event: Event) => void; // TODO: Correctly type this
  scatterPlot?: ComponentProps<typeof Chart>['scatterPlot'];
}

interface Highlight {
  dataPoint: Series['data'][number];
  series: Series[];
}

export function DurationChartWithSamples({
  series,
  scatterPlot,
  isLoading,
  error,
  onHighlight,
}: Props) {
  // TODO: This is duplicated from `DurationChart` in `SampleList`. Resolve the duplication
  const handleChartHighlight: EChartHighlightHandler = function (event) {
    // ignore mouse hovering over the chart legend
    if (!event.batch) {
      return;
    }

    // TODO: Gross hack. Even though `scatterPlot` is a separate prop, it's just an array of `Series` that gets appended to the main series. To find the point that was hovered, we re-construct the correct series order. It would have been cleaner to just pass the scatter plot as its own, single series
    const allSeries = [...series, ...(scatterPlot ?? [])];

    const highlightedDataPoints = event.batch.map(batch => {
      let {seriesIndex} = batch;
      const {dataIndex} = batch;
      // TODO: More hacks. The Chart component partitions the data series into a complete and incomplete series. Wrap the series index to work around overflowing index.
      seriesIndex = seriesIndex % allSeries.length;

      const highlightedSeries = allSeries?.[seriesIndex];
      const highlightedDataPoint = highlightedSeries?.data?.[dataIndex];

      return {series: highlightedSeries, dataPoint: highlightedDataPoint};
    });

    onHighlight?.(highlightedDataPoints, event);
  };

  return (
    <ChartPanel title={getDurationChartTitle('http')}>
      <Chart
        height={CHART_HEIGHT}
        grid={{
          left: '0',
          right: '0',
          top: '8px',
          bottom: '0',
        }}
        data={series}
        onHighlight={handleChartHighlight}
        scatterPlot={scatterPlot}
        loading={isLoading}
        error={error}
        chartColors={[AVG_COLOR]}
        type={ChartType.LINE}
        aggregateOutputFormat="duration"
      />
    </ChartPanel>
  );
}
