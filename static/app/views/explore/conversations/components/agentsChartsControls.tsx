import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconClock} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  ChartIntervalUnspecifiedStrategy,
  useChartInterval,
} from 'sentry/utils/useChartInterval';
import {Referrer} from 'sentry/views/explore/conversations/utils/referrers';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {
  getAgentRunsFilter,
  getToolSpansFilter,
} from 'sentry/views/insights/pages/agents/utils/query';

const AI_CLIENT_FILTER = 'gen_ai.operation.type:ai_client';

function useAgentsChartInterval() {
  return useChartInterval({
    unspecifiedStrategy: ChartIntervalUnspecifiedStrategy.USE_BIGGEST,
  });
}

export function useAgentsChartsState() {
  const [chartInterval] = useAgentsChartInterval();
  const agentOrToolData = useSpans(
    {
      search: `(${getAgentRunsFilter()} OR ${getToolSpansFilter()})`,
      fields: ['id'],
      limit: 1,
    },
    Referrer.CHART
  );
  const llmData = useSpans(
    {
      search: AI_CLIENT_FILTER,
      fields: ['id'],
      limit: 1,
    },
    Referrer.CHART
  );
  const hasNoAgentOrToolData =
    !agentOrToolData.isPending &&
    !agentOrToolData.isError &&
    agentOrToolData.data.length === 0;
  const hasLlmData = !llmData.isPending && !llmData.isError && llmData.data.length > 0;

  return {
    chartInterval,
    hasNoAgentOrToolData,
    isChartDataPending: agentOrToolData.isPending || llmData.isPending,
    showMissingAgentDataBanner: hasNoAgentOrToolData && hasLlmData,
  };
}

export function AgentsChartIntervalSelector() {
  const [chartInterval, setChartInterval, chartIntervalOptions] =
    useAgentsChartInterval();
  const chartIntervalLabel =
    chartIntervalOptions.find(({value}) => value === chartInterval)?.label ??
    chartInterval;

  return (
    <Flex justify="end">
      <Tooltip title={t('Time interval displayed in the charts')}>
        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button
              {...triggerProps}
              aria-label={t('Chart interval: %s', chartIntervalLabel)}
              icon={<IconClock />}
              size="xs"
              variant="transparent"
            >
              {chartIntervalLabel}
            </OverlayTrigger.Button>
          )}
          menuTitle={t('Interval')}
          options={chartIntervalOptions}
          value={chartInterval}
          onChange={option => setChartInterval(option.value)}
        />
      </Tooltip>
    </Flex>
  );
}
