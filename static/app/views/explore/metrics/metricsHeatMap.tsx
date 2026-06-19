import {Fragment, useCallback} from 'react';
import type {UseQueryResult} from '@tanstack/react-query';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {WidgetLoadingPanel} from 'sentry/views/dashboards/widgets/common/widgetLoadingPanel';
import {HeatMapWidgetVisualization} from 'sentry/views/dashboards/widgets/heatMapWidget/heatMapWidgetVisualization';
import {HeatMap} from 'sentry/views/dashboards/widgets/heatMapWidget/plottables/heatMap';
import {HEATMAP_Z_AXIS_SCALE} from 'sentry/views/dashboards/widgets/heatMapWidget/settings';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {WidgetWrapper} from 'sentry/views/explore/metrics/metricGraph/styles';
import {
  useMetricLabel,
  useMetricName,
  useMetricVisualize,
  useMetricVisualizes,
  useTraceMetric,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {STACKED_GRAPH_HEIGHT} from 'sentry/views/explore/metrics/settings';
import {
  useQueryParamsQuery,
  useSetQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';
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
  const userQuery = useQueryParamsQuery();
  const setMetricQuery = useSetQueryParamsQuery();
  const organization = useOrganization();

  const {data: heatMapSeries, isPending, error} = heatmapResult;

  const aggregate = visualize.yAxis;
  const chartTitle =
    visualizes.length > 1
      ? metricName
      : (title ?? metricLabel ?? prettifyAggregation(aggregate) ?? aggregate);

  const updateMetricQuery = useCallback(
    (query: string) => {
      setMetricQuery(userQuery ? `${userQuery} ${query}` : query);
    },
    [userQuery, setMetricQuery]
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
              scale={HEATMAP_Z_AXIS_SCALE}
              updateLocalFilterQuery={updateMetricQuery}
              renderTooltipActions={({cellQuery, selection}) => {
                const tracesUrl = getExploreUrl({
                  organization,
                  selection,
                  crossEvents: [{type: 'metrics', metric, query: cellQuery}],
                });
                return (
                  <Fragment>
                    <div>
                      <span className="tooltip-label tooltip-label-centered">
                        <a data-traces-link={tracesUrl} href={tracesUrl}>
                          {t('View connected spans')}
                        </a>
                      </span>
                    </div>
                    <div>
                      <span className="tooltip-label tooltip-label-centered">
                        <a data-local-query={cellQuery}>{t('Add to filter')}</a>
                      </span>
                    </div>
                  </Fragment>
                );
              }}
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
