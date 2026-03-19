import {t} from 'sentry/locale';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useCombinedQuery} from 'sentry/views/insights/pages/agents/hooks/useCombinedQuery';
import {getAIGenerationsFilter} from 'sentry/views/insights/pages/agents/utils/query';
import {Referrer} from 'sentry/views/insights/pages/agents/utils/referrers';
import {BaseTrafficWidget} from 'sentry/views/insights/pages/platform/shared/baseTrafficWidget';

export function OverviewLLMCallsChartWidget(props: LoadableChartWidgetProps) {
  const query = useCombinedQuery(getAIGenerationsFilter());

  return (
    <BaseTrafficWidget
      id="overviewLLMCallsChartWidget"
      title={t('LLM Calls')}
      trafficSeriesName={t('Calls')}
      query={query}
      referrer={Referrer.LLM_CALLS_TRAFFIC_WIDGET}
      {...props}
    />
  );
}
