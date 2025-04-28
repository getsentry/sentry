import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useParams} from 'sentry/utils/useParams';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useAiPipelineGroup} from 'sentry/views/insights/common/components/widgets/hooks/useAiPipelineGroup';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';

export default function LlmEventNumberOfPipelinesChartWidget(
  props: LoadableChartWidgetProps
) {
  const params = useParams<{groupId: string; eventId?: string}>();
  const {groupId, isPending, error} = useAiPipelineGroup(params);

  const theme = useTheme();
  const aggregate = 'count()';

  let query = 'span.category:"ai.pipeline"';
  if (groupId) {
    query = `${query} span.group:"${groupId}"`;
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
      enabled: !!groupId,
    },
    'api.ai-pipelines.view',
    props.pageFilters
  );

  const colors = theme.chart.getColorPalette(2);
  return (
    <InsightsLineChartWidget
      {...props}
      id="llmEventNumberOfPipelinesChartWidget"
      isLoading={isPending || spanMetricsSeriesIsPending}
      error={error || spanMetricsSeriesError}
      title={t('Number of AI pipelines')}
      series={[{...data[aggregate], color: colors[1]}]}
    />
  );
}
