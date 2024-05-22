import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import Chart, {ChartType} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useDiscoverSeries';

interface TotalTokensUsedChartProps {
  groupId?: string;
}

export function TotalTokensUsedChart({groupId}: TotalTokensUsedChartProps) {
  const aggregate = 'ai_total_tokens_used()';

  let query = 'span.category:"ai"';
  if (groupId) {
    query = `${query} span.ai.pipeline.group:"${groupId}"`;
  }
  const {data, isLoading, error} = useSpanMetricsSeries(
    {
      yAxis: [aggregate],
      search: new MutableSearch(query),
    },
    'api.ai-pipelines.view'
  );

  return (
    <ChartPanel title={t('Total tokens used')}>
      <Chart
        height={200}
        grid={{
          left: '4px',
          right: '0',
          top: '8px',
          bottom: '0',
        }}
        data={[data[aggregate]]}
        loading={isLoading}
        error={error}
        type={ChartType.LINE}
        chartColors={[CHART_PALETTE[2][0]]}
      />
    </ChartPanel>
  );
}

interface NumberOfPipelinesChartProps {
  groupId?: string;
}
export function NumberOfPipelinesChart({groupId}: NumberOfPipelinesChartProps) {
  const aggregate = 'count()';

  let query = 'span.category:"ai.pipeline"';
  if (groupId) {
    query = `${query} span.group:"${groupId}"`;
  }
  const {data, isLoading, error} = useSpanMetricsSeries(
    {
      yAxis: [aggregate],
      search: new MutableSearch(query),
    },
    'api.ai-pipelines.view'
  );

  return (
    <ChartPanel title={t('Number of AI pipelines')}>
      <Chart
        height={200}
        grid={{
          left: '4px',
          right: '0',
          top: '8px',
          bottom: '0',
        }}
        data={[data[aggregate]]}
        loading={isLoading}
        error={error}
        type={ChartType.LINE}
        chartColors={[CHART_PALETTE[2][1]]}
      />
    </ChartPanel>
  );
}

interface PipelineDurationChartProps {
  groupId?: string;
}
export function PipelineDurationChart({groupId}: PipelineDurationChartProps) {
  const aggregate = 'avg(span.duration)';
  let query = 'span.category:"ai.pipeline"';
  if (groupId) {
    query = `${query} span.group:"${groupId}"`;
  }
  const {data, isLoading, error} = useSpanMetricsSeries(
    {
      yAxis: [aggregate],
      search: new MutableSearch(query),
    },
    'api.ai-pipelines.view'
  );

  return (
    <ChartPanel title={t('Pipeline Duration')}>
      <Chart
        height={200}
        grid={{
          left: '4px',
          right: '0',
          top: '8px',
          bottom: '0',
        }}
        data={[data[aggregate]]}
        loading={isLoading}
        error={error}
        type={ChartType.LINE}
        chartColors={[CHART_PALETTE[2][2]]}
      />
    </ChartPanel>
  );
}
