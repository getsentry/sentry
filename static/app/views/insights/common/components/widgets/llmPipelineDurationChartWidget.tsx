import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';

export default function LlmPipelineDurationChartWidget(
  props: LoadableChartWidgetProps<{groupId?: string}>
) {
  const theme = useTheme();
  const aggregate = 'avg(span.duration)';

  let query = 'span.category:"ai.pipeline"';
  if (props.chartProperties?.groupId) {
    query = `${query} span.group:"${props.chartProperties?.groupId}"`;
  }
  const {data, isPending, error} = useSpanMetricsSeries(
    {
      yAxis: [aggregate],
      search: new MutableSearch(query),
      transformAliasToInputFormat: true,
    },
    'api.ai-pipelines.view'
  );

  const colors = theme.chart.getColorPalette(2);
  return (
    <InsightsLineChartWidget
      {...props}
      id="llmPipelineDurationChartWidget"
      title={t('Pipeline Duration')}
      series={[{...data[aggregate], color: colors[2]}]}
      isLoading={isPending}
      error={error}
    />
  );
}
