import styled from '@emotion/styled';

import type {PageFilters} from 'sentry/types';
import {MetricDisplayType} from 'sentry/utils/metrics/types';
import {useMetricsQuery} from 'sentry/utils/metrics/useMetricsQuery';
import withPageFilters from 'sentry/utils/withPageFilters';
import {MetricChartContainer} from 'sentry/views/dashboards/metrics/chart';

interface TokenUsageChartProps {
  metric: 'ai.total_tokens.used' | 'ai.prompt_tokens.used' | 'ai.completion_tokens.used';
  selection: PageFilters;
  isGlobalSelectionReady?: boolean;
}

function TokenUsageChart({selection, metric}: TokenUsageChartProps) {
  const {
    data: timeseriesData,
    isLoading,
    isError,
    error,
  } = useMetricsQuery(
    [
      {
        name: 'a',
        mri: `c:custom/${metric}@tokens`,
        op: 'sum',
      },
    ],
    selection,
    {
      intervalLadder: 'dashboard',
    }
  );

  if (isError) {
    return <div>{'' + error}</div>;
  }

  return (
    <TokenChartContainer>
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

const TokenChartContainer = styled('div')`
  overflow: hidden;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  flex: 1 1 content;
`;

export default withPageFilters(TokenUsageChart);
