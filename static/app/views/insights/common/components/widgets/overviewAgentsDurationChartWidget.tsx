import {useMemo} from 'react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import useOrganization from 'sentry/utils/useOrganization';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {ModalChartContainer} from 'sentry/views/insights/common/components/insightsChartContainer';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useCombinedQuery} from 'sentry/views/insights/pages/agents/hooks/useCombinedQuery';
import {
  getAgentRunsFilter,
  getAITracesFilter,
} from 'sentry/views/insights/pages/agents/utils/query';
import {Referrer} from 'sentry/views/insights/pages/agents/utils/referrers';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/platform/laravel/utils';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {useReleaseBubbleProps} from 'sentry/views/insights/pages/platform/shared/getReleaseBubbleProps';
import {Toolbar} from 'sentry/views/insights/pages/platform/shared/toolbar';

export default function OverviewAgentsDurationChartWidget(
  props: LoadableChartWidgetProps & {hasAgentRuns?: boolean}
) {
  const organization = useOrganization();
  const pageFilterChartParams = usePageFilterChartParams({
    pageFilters: props.pageFilters,
  });
  const releaseBubbleProps = useReleaseBubbleProps(props);

  const fullQuery = useCombinedQuery(
    props.hasAgentRuns ? getAgentRunsFilter() : getAITracesFilter()
  );

  const {data, isLoading, error} = useFetchSpanTimeSeries(
    {
      ...pageFilterChartParams,
      query: fullQuery,
      yAxis: ['avg(span.duration)', 'p95(span.duration)'],
      pageFilters: props.pageFilters,
    },
    Referrer.AGENT_DURATION_WIDGET
  );

  const plottables = useMemo(() => {
    return data?.timeSeries.map(timeSeries => new Line(timeSeries)) ?? [];
  }, [data]);

  const isEmpty = plottables.every(plottable => plottable.isEmpty);

  const visualization = (
    <WidgetVisualizationStates
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      VisualizationType={TimeSeriesWidgetVisualization}
      visualizationProps={{
        id: 'overviewAgentsDurationChartWidget',
        plottables,
        ...props,
        ...releaseBubbleProps,
      }}
    />
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Duration')} />}
      Visualization={visualization}
      Actions={
        organization.features.includes('visibility-explore-view') &&
        !isEmpty && (
          <Toolbar
            showCreateAlert
            referrer={Referrer.AGENT_DURATION_WIDGET}
            exploreParams={{
              mode: Mode.SAMPLES,
              visualize: [
                {
                  chartType: ChartType.LINE,
                  yAxes: ['avg(span.duration)', 'p95(span.duration)'],
                },
              ],
              sort: '-avg(span.duration)',
              query: fullQuery,
              interval: pageFilterChartParams.interval,
            }}
            loaderSource={props.loaderSource}
            onOpenFullScreen={() => {
              openInsightChartModal({
                title: t('Duration'),
                children: <ModalChartContainer>{visualization}</ModalChartContainer>,
              });
            }}
          />
        )
      }
    />
  );
}
