import {captureException} from '@sentry/core';
import {useQuery} from '@tanstack/react-query';

import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {EVENT_GRAPH_WIDGET_ID} from 'sentry/views/issueDetails/streamline/eventGraphWidget';

export type ChartId = keyof typeof CHART_MAP;
interface Props extends LoadableChartWidgetProps {
  /**
   * ID of the Chart
   */
  id: ChartId;

  ref?: React.Ref<ReactEchartsRef>;
}
// We need to map the widget id to the dynamic import because we want the import paths to be statically analyzable.
const CHART_MAP = {
  [EVENT_GRAPH_WIDGET_ID]: () =>
    import('sentry/views/issueDetails/streamline/eventGraphWidget'),
  unhealthySessionsChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/unhealthySessionsChartWidget'
    ),
  userHealthCountChartWidget: () =>
    import('sentry/views/insights/common/components/widgets/userHealthCountChartWidget'),
  userHealthRateChartWidget: () =>
    import('sentry/views/insights/common/components/widgets/userHealthRateChartWidget'),
  sessionHealthRateChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/sessionHealthRateChartWidget'
    ),
  resourceSummaryAverageSizeChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/resourceSummaryAverageSizeChartWidget'
    ),
  resourceSummaryDurationChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/resourceSummaryDurationChartWidget'
    ),
  resourceSummaryThroughputChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/resourceSummaryThroughputChartWidget'
    ),
  sessionHealthCountChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/sessionHealthCountChartWidget'
    ),
  resourceLandingDurationChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/resourceLandingDurationChartWidget'
    ),
  resourceLandingThroughputChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/resourceLandingThroughputChartWidget'
    ),
  crashFreeSessionsChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/crashFreeSessionsChartWidget'
    ),
  releaseSessionCountChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/releaseSessionCountChartWidget'
    ),
  releaseSessionPercentageChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/releaseSessionPercentageChartWidget'
    ),
  llmNumberOfPipelinesChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/llmNumberOfPipelinesChartWidget'
    ),
  llmPipelineDurationChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/llmPipelineDurationChartWidget'
    ),
  llmTotalTokensUsedChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/llmTotalTokensUsedChartWidget'
    ),
  llmGroupPipelineDurationChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/llmGroupPipelineDurationChartWidget'
    ),
  llmGroupTotalTokensUsedChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/llmGroupTotalTokensUsedChartWidget'
    ),
  llmGroupNumberOfPipelinesChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/llmGroupNumberOfPipelinesChartWidget'
    ),
  queuesSummaryThroughputChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/queuesSummaryThroughputChartWidget'
    ),
  releaseNewIssuesChartWidget: () =>
    import('sentry/views/insights/common/components/widgets/releaseNewIssuesChartWidget'),
  performanceScoreBreakdownChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/performanceScoreBreakdownChartWidget'
    ),
  queuesLandingLatencyChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/queuesLandingLatencyChartWidget'
    ),
  queuesLandingThroughputChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/queuesLandingThroughputChartWidget'
    ),
  queuesSummaryLatencyChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/queuesSummaryLatencyChartWidget'
    ),
  newAndResolvedIssueChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/newAndResolvedIssueChartWidget'
    ),
  databaseSummaryThroughputChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/databaseSummaryThroughputChartWidget'
    ),
  databaseLandingDurationChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/databaseLandingDurationChartWidget'
    ),
  databaseLandingThroughputChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/databaseLandingThroughputChartWidget'
    ),
  databaseSummaryDurationChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/databaseSummaryDurationChartWidget'
    ),
  cacheThroughputChartWidget: () =>
    import('sentry/views/insights/common/components/widgets/cacheThroughputChartWidget'),
  cacheMissRateChartWidget: () =>
    import('sentry/views/insights/common/components/widgets/cacheMissRateChartWidget'),
  httpResponseCodesChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/httpResponseCodesChartWidget'
    ),
  httpThroughputChartWidget: () =>
    import('sentry/views/insights/common/components/widgets/httpThroughputChartWidget'),
  httpDomainSummaryResponseCodesChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/httpDomainSummaryResponseCodesChartWidget'
    ),
  httpDomainSummaryThroughputChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/httpDomainSummaryThroughputChartWidget'
    ),
  httpDurationChartWidget: () =>
    import('sentry/views/insights/common/components/widgets/httpDurationChartWidget'),
  httpDomainSummaryDurationChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/httpDomainSummaryDurationChartWidget'
    ),
  overviewAgentsRunsChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/overviewAgentsRunsChartWidget'
    ),
  overviewAgentsDurationChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/overviewAgentsDurationChartWidget'
    ),
  overviewApiLatencyChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/overviewApiLatencyChartWidget'
    ),
  overviewCacheMissChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/overviewCacheMissChartWidget'
    ),
  overviewJobsChartWidget: () =>
    import('sentry/views/insights/common/components/widgets/overviewJobsChartWidget'),
  overviewPageloadsChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/overviewPageloadsChartWidget'
    ),
  overviewRequestsChartWidget: () =>
    import('sentry/views/insights/common/components/widgets/overviewRequestsChartWidget'),
  overviewSlowNextjsSSRWidget: () =>
    import('sentry/views/insights/common/components/widgets/overviewSlowNextjsSSRWidget'),
  overviewSlowQueriesChartWidget: () =>
    import(
      'sentry/views/insights/common/components/widgets/overviewSlowQueriesChartWidget'
    ),
  mcpTrafficWidget: () =>
    import('sentry/views/insights/common/components/widgets/mcpTrafficWidget'),
} satisfies Record<string, () => Promise<{default: React.FC<LoadableChartWidgetProps>}>>;

/**
 * Render an Insights Widget by id.
 *
 * This should be the only interface to render widgets because they
 * can be rendered outside of "Insights" (e.g. in the Releases
 * Global Drawer). In the Releases Global Drawer, we need the ability
 * to render a specific widget via URL, which we do by using the
 * widget's `id` prop. In order to maintain the id -> component
 * mapping, we will disallow importing widget components directly and
 * ensure only this component is used.
 */
export function ChartWidgetLoader(props: Props) {
  const query = useQuery<{default: React.FC<LoadableChartWidgetProps>}>({
    queryKey: [`widget-${props.id}`],
    queryFn: () => {
      if (CHART_MAP.hasOwnProperty(props.id)) {
        const importChartFn = CHART_MAP[props.id];
        if (typeof importChartFn === 'function') {
          return importChartFn();
        }
      }

      return Promise.reject(new Error(`Widget "${props.id}" not found`));
    },
  });

  if (query.isPending) {
    return <Placeholder height="100%" />;
  }

  const Component = query.data?.default;

  if (query.isError || !Component) {
    const error =
      query.error ||
      new Error(
        'Unable to import widget: widget file not found or widget not exported as default export.'
      );
    // eslint-disable-next-line no-console
    console.error(error);
    captureException(error);
    return <Placeholder height="100%" error={t('Error loading widget')} />;
  }

  return <Component {...props} chartRef={props.ref} />;
}
