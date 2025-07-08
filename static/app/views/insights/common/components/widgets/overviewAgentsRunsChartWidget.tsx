import {t} from 'sentry/locale';
import {useCombinedQuery} from 'sentry/views/insights/agentMonitoring/hooks/useCombinedQuery';
import {getAgentRunsFilter} from 'sentry/views/insights/agentMonitoring/utils/query';
import {Referrer} from 'sentry/views/insights/agentMonitoring/utils/referrers';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {BaseTrafficWidget} from 'sentry/views/insights/pages/platform/shared/baseTrafficWidget';

export default function OverviewAgentsRunsChartWidget(props: LoadableChartWidgetProps) {
  const query = useCombinedQuery(getAgentRunsFilter());
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
