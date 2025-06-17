import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useParams} from 'sentry/utils/useParams';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {Referrer} from 'sentry/views/insights/llmMonitoring/referrers';

export default function LlmGroupNumberOfPipelinesChartWidget(
  props: LoadableChartWidgetProps
) {
  const {groupId} = useParams<{groupId: string}>();
  const theme = useTheme();
  const aggregate = 'count()';

  const search = new MutableSearch(`span.category:"ai.pipeline" span.group:"${groupId}"`);
  const referrer = Referrer.GROUP_NUMBER_OF_PIPELINES_CHART;

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
      id="llmGroupNumberOfPipelinesChartWidget"
      title={t('Number of AI pipelines')}
      series={[{...data[aggregate], color: colors[1]}]}
      isLoading={isPending}
      error={error}
    />
  );
}
