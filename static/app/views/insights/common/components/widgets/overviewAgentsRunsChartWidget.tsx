import {t} from 'sentry/locale';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useCombinedQuery} from 'sentry/views/insights/pages/agents/hooks/useCombinedQuery';
import {
  getAgentRunsFilter,
  getAITracesFilter,
} from 'sentry/views/insights/pages/agents/utils/query';
import {Referrer} from 'sentry/views/insights/pages/agents/utils/referrers';
import {BaseTrafficWidget} from 'sentry/views/insights/pages/platform/shared/baseTrafficWidget';

export default function OverviewAgentsRunsChartWidget(
  props: LoadableChartWidgetProps & {hasAgentRuns?: boolean}
) {
  const query = useCombinedQuery(
    props.hasAgentRuns ? getAgentRunsFilter() : getAITracesFilter()
  );

  return (
    <BaseTrafficWidget
      id="overviewAgentsRunsChartWidget"
      title={t('Traffic')}
      trafficSeriesName={t('Runs')}
      query={query}
      referrer={Referrer.AGENT_RUNS_WIDGET}
      {...props}
    />
  );
}
