import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {Referrer} from 'sentry/views/insights/llmMonitoring/referrers';

export default function LlmPipelineDurationChartWidget(props: LoadableChartWidgetProps) {
  const theme = useTheme();
  const aggregate = 'avg(span.duration)';
  const referrer = Referrer.PIPELINE_DURATION_CHART;
  const search = new MutableSearch('span.category:"ai.pipeline"');
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
      id="llmPipelineDurationChartWidget"
      title={t('Pipeline Duration')}
      series={[{...data[aggregate], color: colors[2]}]}
      isLoading={isPending}
      error={error}
      queryInfo={{search, referrer}}
    />
  );
}
