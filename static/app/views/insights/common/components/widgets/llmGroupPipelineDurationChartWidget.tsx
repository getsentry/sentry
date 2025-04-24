import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useParams} from 'sentry/utils/useParams';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';

export default function LlmGroupPipelineDurationChartWidget(
  props: LoadableChartWidgetProps
) {
  const {groupId} = useParams<{groupId: string}>();
  const theme = useTheme();
  const aggregate = 'avg(span.duration)';

  const query = `span.category:"ai.pipeline" span.group:"${groupId}"`;
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
      id="llmGroupPipelineDurationChartWidget"
      title={t('Pipeline duration')}
      series={[{...data[aggregate], color: colors[2]}]}
      isLoading={isPending}
      error={error}
    />
  );
}
