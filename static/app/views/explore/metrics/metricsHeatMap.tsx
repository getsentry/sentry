import {useCallback} from 'react';
import type {UseQueryResult} from '@tanstack/react-query';

import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {WidgetLoadingPanel} from 'sentry/views/dashboards/widgets/common/widgetLoadingPanel';
import {HeatMapWidgetVisualization} from 'sentry/views/dashboards/widgets/heatMapWidget/heatMapWidgetVisualization';
import {HeatMap} from 'sentry/views/dashboards/widgets/heatMapWidget/plottables/heatMap';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {WidgetWrapper} from 'sentry/views/explore/metrics/metricGraph/styles';
import type {BaseMetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {
  useMetricLabel,
  useMetricName,
  useMetricVisualize,
  useMetricVisualizes,
  useTraceMetric,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {STACKED_GRAPH_HEIGHT} from 'sentry/views/explore/metrics/settings';
import {getMetricsUrl} from 'sentry/views/explore/metrics/utils';
import {getExploreUrl, prettifyAggregation} from 'sentry/views/explore/utils';

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
  const metric = useTraceMetric();
  const metricQueries = useMultiMetricsQueryParams();
  const organization = useOrganization();

  const {data: heatMapSeries, isPending, error} = heatmapResult;

  const aggregate = visualize.yAxis;
  const chartTitle =
    visualizes.length > 1
      ? metricName
      : (title ?? metricLabel ?? prettifyAggregation(aggregate) ?? aggregate);

  const getFilteredExploreUrl = useCallback(
    (query: string, filteredSelection: PageFilters) => {
      return getExploreUrl({
        organization,
        selection: filteredSelection,
        crossEvents: [
          {
            type: 'metrics',
            metric,
            query,
          },
        ],
      });
    },
    [metric, organization]
  );

  const getUpdatedMetricsQueryUrl = useCallback(
    (query: string, filteredSelection: PageFilters) => {
      const alteredMetricQueries: BaseMetricQuery[] = metricQueries.map(metricQuery => {
        if (
          metricQuery.metric.name === metric.name &&
          metricQuery.metric.type === metric.type
        ) {
          return {
            ...metricQuery,
            queryParams: metricQuery.queryParams.replace({
              query: `${metricQuery.queryParams.query} ${query}`,
            }),
          };
        }
        return metricQuery;
      });
      return getMetricsUrl({
        organization,
        selection: filteredSelection,
        metricQueries: alteredMetricQueries,
      });
    },
    [metric, metricQueries, organization]
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
              scale="log"
              makeExploreUrl={getFilteredExploreUrl}
              makeLocalQueryUpdateUrl={getUpdatedMetricsQueryUrl}
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
