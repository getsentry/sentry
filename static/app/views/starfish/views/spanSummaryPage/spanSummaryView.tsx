import React from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {RateUnits} from 'sentry/utils/discover/fields';
import {formatRate} from 'sentry/utils/formatters';
import {useLocation} from 'sentry/utils/useLocation';
import {AVG_COLOR, ERRORS_COLOR, THROUGHPUT_COLOR} from 'sentry/views/starfish/colours';
import Chart, {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import StarfishDatePicker from 'sentry/views/starfish/components/datePicker';
import {SpanDescription} from 'sentry/views/starfish/components/spanDescription';
import {useFullSpanFromTrace} from 'sentry/views/starfish/queries/useFullSpanFromTrace';
import {
  SpanSummaryQueryFilters,
  useSpanMetrics,
} from 'sentry/views/starfish/queries/useSpanMetrics';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import {SpanMetricsFields, StarfishFunctions} from 'sentry/views/starfish/types';
import {
  DataTitles,
  getThroughputChartTitle,
} from 'sentry/views/starfish/views/spans/types';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spanSummaryPage/block';
import {SpanMetricsRibbon} from 'sentry/views/starfish/views/spanSummaryPage/spanMetricsRibbon';

const CHART_HEIGHT = 160;

interface Props {
  groupId: string;
}

type Query = {
  endpoint: string;
  endpointMethod: string;
  transaction: string;
  transactionMethod: string;
};

export function SpanSummaryView({groupId}: Props) {
  const location = useLocation<Query>();
  const {endpoint, endpointMethod} = location.query;

  const {data: fullSpan} = useFullSpanFromTrace(groupId);

  const queryFilter: SpanSummaryQueryFilters = endpoint
    ? {transactionName: endpoint, 'transaction.method': endpointMethod}
    : {};

  const {data: spanMetrics} = useSpanMetrics(
    groupId,
    queryFilter,
    [
      SpanMetricsFields.SPAN_OP,
      SpanMetricsFields.SPAN_DESCRIPTION,
      SpanMetricsFields.SPAN_ACTION,
      SpanMetricsFields.SPAN_DOMAIN,
      'count()',
      `${StarfishFunctions.SPM}()`,
      `sum(${SpanMetricsFields.SPAN_SELF_TIME})`,
      `avg(${SpanMetricsFields.SPAN_SELF_TIME})`,
      `${StarfishFunctions.TIME_SPENT_PERCENTAGE}()`,
      `${StarfishFunctions.HTTP_ERROR_COUNT}()`,
    ],
    'api.starfish.span-summary-page-metrics'
  );

  const span = {
    ...spanMetrics,
    [SpanMetricsFields.SPAN_GROUP]: groupId,
  } as {
    [SpanMetricsFields.SPAN_OP]: string;
    [SpanMetricsFields.SPAN_DESCRIPTION]: string;
    [SpanMetricsFields.SPAN_ACTION]: string;
    [SpanMetricsFields.SPAN_DOMAIN]: string;
    [SpanMetricsFields.SPAN_GROUP]: string;
  };

  const {isLoading: areSpanMetricsSeriesLoading, data: spanMetricsSeriesData} =
    useSpanMetricsSeries(
      groupId,
      queryFilter,
      [`avg(${SpanMetricsFields.SPAN_SELF_TIME})`, 'spm()', 'http_error_count()'],
      'api.starfish.span-summary-page-metrics-chart'
    );

  useSynchronizeCharts([!areSpanMetricsSeriesLoading]);

  const spanMetricsThroughputSeries = {
    seriesName: span?.[SpanMetricsFields.SPAN_OP]?.startsWith('db')
      ? 'Queries'
      : 'Requests',
    data: spanMetricsSeriesData?.['spm()'].data,
  };

  return (
    <React.Fragment>
      <HeaderContainer>
        <FilterOptionsContainer>
          <StarfishDatePicker />
        </FilterOptionsContainer>

        <SpanMetricsRibbon spanMetrics={span} />
      </HeaderContainer>

      {span?.[SpanMetricsFields.SPAN_DESCRIPTION] && (
        <DescriptionContainer>
          <SpanDescription
            span={{
              ...span,
              [SpanMetricsFields.SPAN_DESCRIPTION]:
                fullSpan?.description ??
                spanMetrics?.[SpanMetricsFields.SPAN_DESCRIPTION],
            }}
          />
        </DescriptionContainer>
      )}

      <BlockContainer>
        <Block>
          <ChartPanel title={getThroughputChartTitle(span?.[SpanMetricsFields.SPAN_OP])}>
            <Chart
              height={CHART_HEIGHT}
              data={[spanMetricsThroughputSeries]}
              loading={areSpanMetricsSeriesLoading}
              utc={false}
              chartColors={[THROUGHPUT_COLOR]}
              isLineChart
              definedAxisTicks={4}
              aggregateOutputFormat="rate"
              rateUnit={RateUnits.PER_MINUTE}
              tooltipFormatterOptions={{
                valueFormatter: value => formatRate(value, RateUnits.PER_MINUTE),
              }}
            />
          </ChartPanel>
        </Block>

        <Block>
          <ChartPanel title={DataTitles.avg}>
            <Chart
              height={CHART_HEIGHT}
              data={[spanMetricsSeriesData?.[`avg(${SpanMetricsFields.SPAN_SELF_TIME})`]]}
              loading={areSpanMetricsSeriesLoading}
              utc={false}
              chartColors={[AVG_COLOR]}
              isLineChart
              definedAxisTicks={4}
            />
          </ChartPanel>
        </Block>

        {span?.[SpanMetricsFields.SPAN_OP]?.startsWith('http') && (
          <Block>
            <ChartPanel title={DataTitles.errorCount}>
              <Chart
                height={CHART_HEIGHT}
                data={[spanMetricsSeriesData?.[`http_error_count()`]]}
                loading={areSpanMetricsSeriesLoading}
                utc={false}
                chartColors={[ERRORS_COLOR]}
                isLineChart
                definedAxisTicks={4}
              />
            </ChartPanel>
          </Block>
        )}
      </BlockContainer>
    </React.Fragment>
  );
}

const FilterOptionsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  align-items: center;
  padding-bottom: ${space(2)};
`;

const HeaderContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
`;

const DescriptionContainer = styled('div')`
  width: 100%;
  margin-bottom: ${space(2)};
  font-size: 1rem;
  line-height: 1.2;
`;
