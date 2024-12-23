import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {
  useSpanIndexedSeries,
  useSpanMetricsSeries,
} from 'sentry/views/insights/common/queries/useDiscoverSeries';

interface TotalTokensUsedChartProps {
  groupId?: string;
}

export function EAPTotalTokensUsedChart({groupId}: TotalTokensUsedChartProps) {
  const aggregate = 'sum(ai.total_tokens.used)';

  let query = 'span.category:"ai"';
  if (groupId) {
    query = `${query} span.ai.pipeline.group:"${groupId}"`;
  }
  const {data, isPending, error} = useSpanIndexedSeries(
    {
      yAxis: [aggregate],
      search: new MutableSearch(query),
      transformAliasToInputFormat: true,
    },
    'api.ai-pipelines.view',
    DiscoverDatasets.SPANS_EAP
  );

  return (
    <InsightsLineChartWidget
      title={t('Total tokens used')}
      series={[{...data[aggregate], color: CHART_PALETTE[2][0]}]}
      isLoading={isPending}
      error={error}
    />
  );
}

export function TotalTokensUsedChart({groupId}: TotalTokensUsedChartProps) {
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

  return (
    <InsightsLineChartWidget
      title={t('Total tokens used')}
      series={[{...data[aggregate], color: CHART_PALETTE[2][0]}]}
      isLoading={isPending}
      error={error}
    />
  );
}

interface NumberOfPipelinesChartProps {
  groupId?: string;
}

export function EAPNumberOfPipelinesChart({groupId}: NumberOfPipelinesChartProps) {
  const aggregate = 'count()';

  let query = 'span.category:"ai.pipeline"';
  if (groupId) {
    query = `${query} span.group:"${groupId}"`;
  }
  const {data, isPending, error} = useSpanIndexedSeries(
    {
      yAxis: [aggregate],
      search: new MutableSearch(query),
      transformAliasToInputFormat: true,
    },
    'api.ai-pipelines-eap.view',
    DiscoverDatasets.SPANS_EAP
  );

  return (
    <InsightsLineChartWidget
      title={t('Number of AI pipelines')}
      series={[{...data[aggregate], color: CHART_PALETTE[2][1]}]}
      isLoading={isPending}
      error={error}
    />
  );
}
export function NumberOfPipelinesChart({groupId}: NumberOfPipelinesChartProps) {
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

  return (
    <InsightsLineChartWidget
      title={t('Number of AI pipelines')}
      series={[{...data[aggregate], color: CHART_PALETTE[2][1]}]}
      isLoading={isPending}
      error={error}
    />
  );
}

interface PipelineDurationChartProps {
  groupId?: string;
}

export function EAPPipelineDurationChart({groupId}: PipelineDurationChartProps) {
  const aggregate = 'avg(span.duration)';
  let query = 'span.category:"ai.pipeline"';
  if (groupId) {
    query = `${query} span.group:"${groupId}"`;
  }
  const {data, isPending, error} = useSpanIndexedSeries(
    {
      yAxis: [aggregate],
      search: new MutableSearch(query),
      transformAliasToInputFormat: true,
    },
    'api.ai-pipelines-eap.view',
    DiscoverDatasets.SPANS_EAP
  );

  return (
    <InsightsLineChartWidget
      title={t('Pipeline Duration')}
      series={[{...data[aggregate], color: CHART_PALETTE[2][2]}]}
      isLoading={isPending}
      error={error}
    />
  );
}

export function PipelineDurationChart({groupId}: PipelineDurationChartProps) {
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

  return (
    <InsightsLineChartWidget
      title={t('Pipeline Duration')}
      series={[{...data[aggregate], color: CHART_PALETTE[2][2]}]}
      isLoading={isPending}
      error={error}
    />
  );
}
