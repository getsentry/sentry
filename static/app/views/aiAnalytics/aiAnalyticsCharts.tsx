import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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

export function NumberOfPipelinesChart() {
  const {selection, isReady: isGlobalSelectionReady} = usePageFilters();
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
        query: 'span.op:"ai.pipeline.langchain"', // TODO: for now this is the only AI "pipeline" supported
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

export function PipelineDurationChart() {
  const {selection, isReady: isGlobalSelectionReady} = usePageFilters();
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
        op: 'avg',
        query: 'span.op:"ai.pipeline.langchain"', // TODO: for now this is the only AI "pipeline" supported
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
      <PanelTitle>{t('AI pipeline duration')}</PanelTitle>
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

const PanelTitle = styled('h5')`
  padding: ${space(3)} ${space(3)} 0;
  margin: 0;
`;

const TokenChartContainer = styled('div')`
  overflow: hidden;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  height: 100%;
  display: flex;
  flex-direction: column;
`;
