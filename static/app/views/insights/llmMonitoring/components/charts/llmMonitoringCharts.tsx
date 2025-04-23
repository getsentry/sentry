import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';

interface TotalTokensUsedChartProps {
  groupId?: string;
}

export function TotalTokensUsedChart({groupId}: TotalTokensUsedChartProps) {
  const theme = useTheme();
  const aggregate = 'sum(ai.total_tokens.used)';

  let query = 'span.category:"ai"';
  if (groupId) {
    query = `${query} span.ai.pipeline.group:"${groupId}"`;
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
      title={t('Total tokens used')}
      series={[{...data[aggregate], color: colors[0]}]}
      isLoading={isPending}
      error={error}
    />
  );
}

interface NumberOfPipelinesChartProps {
  groupId?: string;
}

export function NumberOfPipelinesChart({groupId}: NumberOfPipelinesChartProps) {
  const theme = useTheme();
  const aggregate = 'count()';

  let query = 'span.category:"ai.pipeline"';
  if (groupId) {
    query = `${query} span.group:"${groupId}"`;
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
      title={t('Number of AI pipelines')}
      series={[{...data[aggregate], color: colors[1]}]}
      isLoading={isPending}
      error={error}
    />
  );
}

interface PipelineDurationChartProps {
  groupId?: string;
}

export function PipelineDurationChart({groupId}: PipelineDurationChartProps) {
  const theme = useTheme();

  const aggregate = 'avg(span.duration)';
  let query = 'span.category:"ai.pipeline"';
  if (groupId) {
    query = `${query} span.group:"${groupId}"`;
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
      title={t('Pipeline Duration')}
      series={[{...data[aggregate], color: colors[2]}]}
      isLoading={isPending}
      error={error}
    />
  );
}
