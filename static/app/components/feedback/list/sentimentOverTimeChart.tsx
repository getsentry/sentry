import {useTheme} from '@emotion/react';

import useSentimentOverTime from 'sentry/components/feedback/list/useSentimentOverTime';
import Placeholder from 'sentry/components/placeholder';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';

export default function SentimentOverTimeChart() {
  const {series, loading, error} = useSentimentOverTime();
  const theme = useTheme();

  const colorPalette = theme.chart.getColorPalette(series.length - 2);
  const plottables = series.map(
    (ts, index) =>
      new Line(convertSeriesToTimeseries(ts), {
        color: colorPalette[index],
        alias: ts.seriesName,
      })
  );

  const hasData = series?.length;
  const isLoading = loading;

  if (isLoading) {
    return <Placeholder height="200px" />;
  }

  const visualization = (
    <WidgetVisualizationStates
      isEmpty={!hasData}
      isLoading={isLoading}
      error={error}
      VisualizationType={TimeSeriesWidgetVisualization}
      visualizationProps={{
        plottables,
      }}
    />
  );

  return <Widget height={200} Visualization={visualization} />;
}
