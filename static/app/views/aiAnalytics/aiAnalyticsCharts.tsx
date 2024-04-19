import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricsQueryApiResponseLastMeta} from 'sentry/types';
import {MetricDisplayType} from 'sentry/utils/metrics/types';
import {useMetricsQuery} from 'sentry/utils/metrics/useMetricsQuery';
import usePageFilters from 'sentry/utils/usePageFilters';
import {MetricChartContainer} from 'sentry/views/dashboards/metrics/chart';

export function TotalTokensUsedChart() {
  const {selection, isReady: isGlobalSelectionReady} = usePageFilters();
  const {
    data: timeseriesData,
    isLoading,
    isError,
    error,
  } = useMetricsQuery(
    [
      {
        name: 'total',
        mri: `c:spans/ai.total_tokens.used@none`,
        op: 'sum',
        // TODO this double counts the (e.g.) langchain and openai token usage
      },
    ],
    selection,
    {
      intervalLadder: 'dashboard',
    }
  );

  if (!isGlobalSelectionReady) {
    return null;
  }

  if (isError) {
    return <div>{'' + error}</div>;
  }

  return (
    <TokenChartContainer>
      <PanelTitle>{t('Total tokens used')}</PanelTitle>
      <MetricChartContainer
        timeseriesData={timeseriesData}
        isLoading={isLoading}
        metricQueries={[
          {
            name: 'mql',
            formula: '$total',
          },
        ]}
        displayType={MetricDisplayType.AREA}
        chartHeight={200}
      />
    </TokenChartContainer>
  );
}

interface NumberOfPipelinesChartProps {
  groupId?: string;
}
export function NumberOfPipelinesChart({groupId}: NumberOfPipelinesChartProps) {
  const {selection, isReady: isGlobalSelectionReady} = usePageFilters();
  let query = 'span.category:"ai.pipeline"';
  if (groupId) {
    query = `${query} span.group:"${groupId}"`;
  }
  const {
    data: timeseriesData,
    isLoading,
    isError,
    error,
  } = useMetricsQuery(
    [
      {
        name: 'number',
        mri: `d:spans/exclusive_time@millisecond`,
        op: 'count',
        query,
      },
    ],
    selection,
    {
      intervalLadder: 'dashboard',
    }
  );

  if (!isGlobalSelectionReady) {
    return null;
  }

  if (isError) {
    return <div>{'' + error}</div>;
  }

  return (
    <TokenChartContainer>
      <PanelTitle>{t('Number of AI pipelines')}</PanelTitle>
      <MetricChartContainer
        timeseriesData={timeseriesData}
        isLoading={isLoading}
        metricQueries={[
          {
            name: 'mql',
            formula: '$number',
          },
        ]}
        displayType={MetricDisplayType.AREA}
        chartHeight={200}
      />
    </TokenChartContainer>
  );
}

interface PipelineDurationChartProps {
  groupId?: string;
}
export function PipelineDurationChart({groupId}: PipelineDurationChartProps) {
  const {selection, isReady: isGlobalSelectionReady} = usePageFilters();
  let query = 'span.category:"ai.pipeline"';
  if (groupId) {
    query = `${query} span.group:"${groupId}"`;
  }
  const {
    data: timeseriesData,
    isLoading,
    isError,
    error,
  } = useMetricsQuery(
    [
      {
        name: 'a',
        mri: `d:spans/duration@millisecond`,
        op: 'avg',
        query,
      },
    ],
    selection,
    {
      intervalLadder: 'dashboard',
    }
  );
  const lastMeta = timeseriesData?.meta?.findLast(_ => true);
  if (lastMeta && lastMeta.length >= 2) {
    // TODO hack: there is a bug somewhere that is dropping the unit
    (lastMeta[1] as MetricsQueryApiResponseLastMeta).unit = 'millisecond';
  }

  if (!isGlobalSelectionReady) {
    return null;
  }

  if (isError) {
    return <div>{'' + error}</div>;
  }

  return (
    <TokenChartContainer>
      <PanelTitle>{t('AI pipeline duration')}</PanelTitle>
      <MetricChartContainer
        timeseriesData={timeseriesData}
        isLoading={isLoading}
        metricQueries={[
          {
            name: 'mql',
            formula: '$a',
          },
        ]}
        displayType={MetricDisplayType.AREA}
        chartHeight={200}
      />
    </TokenChartContainer>
  );
}

const PanelTitle = styled('h5')`
  padding: ${space(3)} ${space(3)} 0;
  margin: 0;
`;

const TokenChartContainer = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  height: 100%;
  display: flex;
  flex-direction: column;
`;
