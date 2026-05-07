import {Container} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import {WidgetLoadingPanel} from 'sentry/views/dashboards/widgets/common/widgetLoadingPanel';
import {HeatMapWidgetVisualization} from 'sentry/views/dashboards/widgets/heatMapWidget/heatMapWidgetVisualization';
import {HeatMap} from 'sentry/views/dashboards/widgets/heatMapWidget/plottables/heatMap';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {useMetricHeatmap} from 'sentry/views/explore/metrics/hooks/useMetricHeatmap';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

interface MetricsHeatmapVisualizationProps {
  enabled: boolean;
  traceMetric: TraceMetric;
}

export function MetricsHeatmapVisualization({
  traceMetric,
  enabled,
}: MetricsHeatmapVisualizationProps) {
  const {heatMapSeries, isPending, error} = useMetricHeatmap({traceMetric, enabled});

  if (isPending || !heatMapSeries) {
    return <WidgetLoadingPanel />;
  }

  if (error) {
    return (
      <Container position="absolute" inset={0}>
        <Widget.WidgetError error={error} />
      </Container>
    );
  }

  if (heatMapSeries.values.length === 0) {
    return (
      <Container position="absolute" inset={0}>
        <Widget.WidgetError error={t('No data')} />
      </Container>
    );
  }

  return (
    <HeatMapWidgetVisualization plottables={[new HeatMap(heatMapSeries)]} scale="log" />
  );
}
