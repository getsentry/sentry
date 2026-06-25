import {Fragment, useCallback} from 'react';
import type {UseQueryResult} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
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
  useTraceMetric,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {STACKED_GRAPH_HEIGHT} from 'sentry/views/explore/metrics/settings';
import {
  useQueryParamsQuery,
  useSetQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';
import {getExploreUrl, prettifyAggregation} from 'sentry/views/explore/utils';

// Tooltip action id for the "Add to filter" button, wired to a handler via
// `tooltipActionHandlers`.
const ADD_TO_FILTER_ACTION = 'add-to-filter';

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
  const {selection} = usePageFilters();

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
              tooltipActionHandlers={{[ADD_TO_FILTER_ACTION]: updateMetricQuery}}
              renderTooltipActions={({
                valueMin,
                valueMax,
                timestampStart,
                timestampEnd,
              }) => {
                const valueQuery =
                  valueMin === valueMax
                    ? `value:<=${valueMin}`
                    : `value:>=${valueMin} value:<${valueMax}`;
                const tracesUrl = getExploreUrl({
                  organization,
                  selection: {
                    ...selection,
                    datetime: {
                      ...selection.datetime,
                      start: new Date(timestampStart),
                      end: new Date(timestampEnd),
                      period: null,
                    },
                  },
                  crossEvents: [{type: 'metrics', metric, query: valueQuery}],
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
                        <a
                          data-tooltip-action={ADD_TO_FILTER_ACTION}
                          data-tooltip-action-value={valueQuery}
                        >
                          {t('Add to filter')}
                        </a>
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
