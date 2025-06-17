import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useParams} from 'sentry/utils/useParams';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {Referrer} from 'sentry/views/insights/llmMonitoring/referrers';

export default function LlmGroupTotalTokensUsedChartWidget(
  props: LoadableChartWidgetProps
) {
  const {groupId} = useParams<{groupId: string}>();
  const theme = useTheme();
  const aggregate = 'sum(ai.total_tokens.used)';
  const referrer = Referrer.GROUP_TOTAL_TOKENS_USED_CHART;
  const search = new MutableSearch(
    `span.category:"ai" span.ai.pipeline.group:"${groupId}"`
  );

  const {data, isPending, error} = useSpanMetricsSeries(
    {
      yAxis: [aggregate],
      search,
      transformAliasToInputFormat: true,
    },
    referrer,
    props.pageFilters
  );

  const colors = theme.chart.getColorPalette(2);
  return (
    <InsightsLineChartWidget
      {...props}
      queryInfo={{search, referrer}}
      id="llmGroupTotalTokensUsedChartWidget"
      title={t('Total tokens used')}
      series={[{...data[aggregate], color: colors[0]}]}
      isLoading={isPending}
      error={error}
    />
  );
}
