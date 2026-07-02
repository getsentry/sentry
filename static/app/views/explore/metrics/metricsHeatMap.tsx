import {useCallback} from 'react';
import type {UseQueryResult} from '@tanstack/react-query';

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
import {encodeMetricQueryParams} from 'sentry/views/explore/metrics/metricQuery';
import {
  useMetricLabel,
  useMetricName,
  useMetricVisualize,
  useMetricVisualizes,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {STACKED_GRAPH_HEIGHT} from 'sentry/views/explore/metrics/settings';
import {useQueryParams} from 'sentry/views/explore/queryParams/context';
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
  const queryParams = useQueryParams();
  const metricQueries = useMultiMetricsQueryParams();
  const location = useLocation();
  const navigate = useNavigate();

  const {data: heatMapSeries, isPending, error} = heatmapResult;

  const aggregate = visualize.yAxis;
  const chartTitle =
    visualizes.length > 1
      ? metricName
      : (title ?? metricLabel ?? prettifyAggregation(aggregate) ?? aggregate);

  // Drag-to-zoom: the X span narrows the page time range, the Y span replaces
  // this metric's `value` filter (so repeated zooms keep narrowing instead of
  // stacking bounds). Both go in a single `navigate` — separate navigations
  // would each compute from the same stale location and clobber each other,
  // dropping the datetime from the URL.
  const handleZoom = useCallback(
    ({timestampStart, timestampEnd, valueMin, valueMax}: HeatMapZoomContext) => {
      const newQueryParams = queryParams.replace({
        query: setExploreAttributeBounds(queryParams.query, 'value', valueMin, valueMax),
      });
      const metric = metricQueries
        .map(metricQuery =>
          metricQuery.queryParams === queryParams
            ? encodeMetricQueryParams({...metricQuery, queryParams: newQueryParams})
            : encodeMetricQueryParams(metricQuery)
        )
        .filter(Boolean);

      navigate(
        {
          ...location,
          query: {
            ...location.query,
            metric,
            start: getUtcDateString(Math.floor(timestampStart / 60_000) * 60_000),
            end: getUtcDateString(Math.ceil(timestampEnd / 60_000) * 60_000),
            statsPeriod: undefined,
          },
        },
        {preventScrollReset: true}
      );
    },
    [queryParams, metricQueries, location, navigate]
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
