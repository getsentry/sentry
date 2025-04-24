import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';

export default function LlmNumberOfPipelinesChartWidget(props: LoadableChartWidgetProps) {
  const theme = useTheme();
  const aggregate = 'count()';

  const query = 'span.category:"ai.pipeline"';
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
      id="llmNumberOfPipelinesChartWidget"
      title={t('Number of AI pipelines')}
      series={[{...data[aggregate], color: colors[1]}]}
      isLoading={isPending}
      error={error}
    />
  );
}
