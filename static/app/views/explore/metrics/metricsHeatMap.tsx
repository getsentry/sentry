import type {UseQueryResult} from '@tanstack/react-query';

import {t} from 'sentry/locale';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {WidgetLoadingPanel} from 'sentry/views/dashboards/widgets/common/widgetLoadingPanel';
import {HeatMapWidgetVisualization} from 'sentry/views/dashboards/widgets/heatMapWidget/heatMapWidgetVisualization';
import {HeatMap} from 'sentry/views/dashboards/widgets/heatMapWidget/plottables/heatMap';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {WidgetWrapper} from 'sentry/views/explore/metrics/metricGraph/styles';
import {
  useMetricLabel,
  useMetricName,
  useMetricVisualize,
  useMetricVisualizes,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {STACKED_GRAPH_HEIGHT} from 'sentry/views/explore/metrics/settings';
import {prettifyAggregation} from 'sentry/views/explore/utils';

interface MetricsHeatMapProps {
  actions: React.ReactNode;
  heatmapResult: UseQueryResult<HeatMapSeries>;
  title?: string;
}

export function MetricsHeatMap({heatmapResult, actions, title}: MetricsHeatMapProps) {
  const visualize = useMetricVisualize();
  const visualizes = useMetricVisualizes();
  const metricLabel = useMetricLabel();
  const metricName = useMetricName();

  const {data: heatMapSeries, isPending, error} = heatmapResult;

  const aggregate = visualize.yAxis;
  const chartTitle =
    visualizes.length > 1
      ? metricName
      : (title ?? metricLabel ?? prettifyAggregation(aggregate) ?? aggregate);

  return (
    <WidgetWrapper>
      <Widget
        Title={<Widget.WidgetTitle title={chartTitle} />}
        Actions={actions}
        Visualization={
          error ? (
            <Widget.WidgetError error={error} />
          ) : isPending || !heatMapSeries ? (
            <WidgetLoadingPanel />
          ) : heatMapSeries.values.length === 0 ? (
            <Widget.WidgetError error={t('No data')} />
          ) : (
            <HeatMapWidgetVisualization
              plottables={[new HeatMap(heatMapSeries)]}
              scale="log"
            />
          )
        }
        height={STACKED_GRAPH_HEIGHT}
        revealActions="always"
        borderless
      />
    </WidgetWrapper>
  );
}
