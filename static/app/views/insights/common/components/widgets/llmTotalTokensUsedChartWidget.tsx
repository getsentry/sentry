import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';

export default function LlmTotalTokensUsedChartWidget(props: LoadableChartWidgetProps) {
  const theme = useTheme();
  const aggregate = 'sum(ai.total_tokens.used)';

  const query = 'span.category:"ai"';
  const {data, isPending, error} = useSpanMetricsSeries(
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
      id="llmTotalTokensUsedChartWidget"
      title={t('Total tokens used')}
      series={[{...data[aggregate], color: colors[0]}]}
      isLoading={isPending}
      error={error}
    />
  );
}
