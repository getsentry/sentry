import {useMemo} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import type {MetricsQueryApiResponse} from 'sentry/types/metrics';
import {formatMetricUsingUnit} from 'sentry/utils/metrics/formatters';
import {LoadingScreen} from 'sentry/views/dashboards/widgetCard/widgetCardChartContainer';

interface MetricBigNumberContainerProps {
  isLoading: boolean;
  timeseriesData?: MetricsQueryApiResponse;
}

export function MetricBigNumberContainer({
  timeseriesData,
  isLoading,
}: MetricBigNumberContainerProps) {
  const bigNumberData = useMemo(() => {
    return timeseriesData ? getBigNumberData(timeseriesData) : undefined;
  }, [timeseriesData]);

  return (
    <BigNumberWrapper>
      <LoadingScreen loading={isLoading} />
      <BigNumber>{bigNumberData}</BigNumber>
    </BigNumberWrapper>
  );
}

export function getBigNumberData(data: MetricsQueryApiResponse): string {
  try {
    // Big number widgets only have one query
    const value = data.data[0]![0]!.totals;
    const lastMetaEntry = data.meta[0]![1];
    const metaUnit =
      (lastMetaEntry && 'unit' in lastMetaEntry && lastMetaEntry.unit) || 'none';

    return formatMetricUsingUnit(value, metaUnit);
  } catch (e) {
    // TODO(metrics): handle this when adding support for bing number equations
    return '-';
  }
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
