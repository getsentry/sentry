import {useCallback} from 'react';
import type {UseQueryResult} from '@tanstack/react-query';

import {updateDateTime} from 'sentry/components/pageFilters/actions';
import {t} from 'sentry/locale';
import {getUtcDateString} from 'sentry/utils/dates';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {WidgetLoadingPanel} from 'sentry/views/dashboards/widgets/common/widgetLoadingPanel';
import {
  HeatMapWidgetVisualization,
  type HeatMapZoomContext,
} from 'sentry/views/dashboards/widgets/heatMapWidget/heatMapWidgetVisualization';
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
import {
  useQueryParamsQuery,
  useSetQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';
import {prettifyAggregation} from 'sentry/views/explore/utils';
import {setExploreAttributeBounds} from 'sentry/views/explore/utils/setExploreAttributeBounds';

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
  const userQuery = useQueryParamsQuery();
  const setMetricQuery = useSetQueryParamsQuery();
  const location = useLocation();
  const navigate = useNavigate();

  const {data: heatMapSeries, isPending, error} = heatmapResult;

  const aggregate = visualize.yAxis;
  const chartTitle =
    visualizes.length > 1
      ? metricName
      : (title ?? metricLabel ?? prettifyAggregation(aggregate) ?? aggregate);

  // Drag-to-zoom: the X span narrows the global page time range, the Y span
  // replaces the `value` filter so zooming in repeatedly keeps narrowing
  // instead of stacking contradictory bounds.
  const handleZoom = useCallback(
    ({timestampStart, timestampEnd, valueMin, valueMax}: HeatMapZoomContext) => {
      updateDateTime(
        {
          start: getUtcDateString(Math.floor(timestampStart / 60_000) * 60_000),
          end: getUtcDateString(Math.ceil(timestampEnd / 60_000) * 60_000),
          period: null,
        },
        location,
        navigate
      );
      setMetricQuery(setExploreAttributeBounds(userQuery, 'value', valueMin, valueMax));
    },
    [location, navigate, setMetricQuery, userQuery]
  );

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
              onZoom={handleZoom}
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
