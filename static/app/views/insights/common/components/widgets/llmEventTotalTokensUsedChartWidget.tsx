import {useTheme} from '@emotion/react';

import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useParams} from 'sentry/utils/useParams';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useAiPipelineGroup} from 'sentry/views/insights/common/components/widgets/hooks/useAiPipelineGroup';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';

export default function LlmEventTotalTokensUsedChartWidget(
  props: LoadableChartWidgetProps
) {
  const params = useParams<{groupId: string; eventId?: string}>();
  const {groupId, isPending, error} = useAiPipelineGroup(params);

  const theme = useTheme();
  const aggregate = 'sum(ai.total_tokens.used)';

  let query = 'span.category:"ai"';
  if (groupId) {
    query = `${query} span.ai.pipeline.group:"${groupId}"`;
  }
  const {
    data,
    isPending: spanMetricsSeriesIsPending,
    error: spanMetricsSeriesError,
  } = useSpanMetricsSeries(
    {
      yAxis: [aggregate],
      search: new MutableSearch(query),
      transformAliasToInputFormat: true,
    },
    'api.ai-pipelines.view',
    props.pageFilters
  );

  const colors = theme.chart.getColorPalette(2);
  return (
    <InsightsLineChartWidget
      {...props}
      id="llmEventTotalTokensUsedChartWidget"
      isLoading={isPending || spanMetricsSeriesIsPending}
      error={error || spanMetricsSeriesError}
      title={t('Total tokens used')}
      series={[{...data[aggregate], color: colors[0]}]}
    />
  );
}
