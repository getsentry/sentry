import {useMemo} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import type {MetricsQueryApiResponse} from 'sentry/types';
import {formatMetricsUsingUnitAndOp} from 'sentry/utils/metrics/formatters';
import {parseMRI} from 'sentry/utils/metrics/mri';
import type {
  DashboardMetricsExpression,
  DashboardMetricsQuery,
} from 'sentry/views/dashboards/metrics/types';
import {isMetricEquation} from 'sentry/views/dashboards/metrics/utils';
import {LoadingScreen} from 'sentry/views/dashboards/widgetCard/widgetCardChartContainer';

interface MetricBigNumberContainerProps {
  expressions: DashboardMetricsExpression[];
  isLoading: boolean;
  timeseriesData?: MetricsQueryApiResponse;
}

export function MetricBigNumberContainer({
  timeseriesData,
  expressions,
  isLoading,
}: MetricBigNumberContainerProps) {
  const bigNumberData = useMemo(() => {
    return timeseriesData ? getBigNumberData(timeseriesData, expressions) : undefined;
  }, [timeseriesData, expressions]);

  return (
    <BigNumberWrapper>
      <LoadingScreen loading={isLoading} />
      <BigNumber>{bigNumberData}</BigNumber>
    </BigNumberWrapper>
  );
}

export function getBigNumberData(
  data: MetricsQueryApiResponse,
  queries: DashboardMetricsExpression[]
): string {
  const filteredQueries = queries.filter(
    query => !isMetricEquation(query)
  ) as DashboardMetricsQuery[];

  const firstQuery = filteredQueries[0];

  const value = data.data[0][0].totals;

  return formatMetricsUsingUnitAndOp(
    value,
    parseMRI(firstQuery.mri)?.unit!,
    firstQuery.op
  );
}

const BigNumberWrapper = styled('div')`
  height: 100%;
  width: 100%;
  overflow: hidden;
`;

export const BigNumber = styled('div')`
  line-height: 1;
  display: inline-flex;
  flex: 1;
  width: 100%;
  min-height: 0;
  font-size: 32px;
  color: ${p => p.theme.headingColor};
  padding: ${space(1)} ${space(3)} ${space(3)} ${space(3)};

  * {
    text-align: left !important;
  }
`;
