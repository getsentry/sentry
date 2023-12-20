import {Fragment} from 'react';
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
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import {
  SpanFunction,
  SpanMetricsField,
  SpanMetricsQueryFilters,
} from 'sentry/views/starfish/types';
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

  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
  };

  if (endpoint) {
    filters.transaction = endpoint;
    filters['transaction.method'] = endpointMethod;
  }

  const {data} = useSpanMetrics(
    filters,
    [
      SpanMetricsField.SPAN_OP,
      SpanMetricsField.SPAN_DESCRIPTION,
      SpanMetricsField.SPAN_ACTION,
      SpanMetricsField.SPAN_DOMAIN,
      'count()',
      `${SpanFunction.SPM}()`,
      `sum(${SpanMetricsField.SPAN_SELF_TIME})`,
      `avg(${SpanMetricsField.SPAN_SELF_TIME})`,
      `${SpanFunction.TIME_SPENT_PERCENTAGE}()`,
      `${SpanFunction.HTTP_ERROR_COUNT}()`,
    ],
    undefined,
    undefined,
    undefined,
    'api.starfish.span-summary-page-metrics'
  );

  const spanMetrics = data[0] ?? {};

  const seriesQueryFilter: SpanMetricsQueryFilters = endpoint
    ? {
        transaction: endpoint,
        'transaction.method': endpointMethod,
      }
    : {};

  const span = {
    ...spanMetrics,
    [SpanMetricsField.SPAN_GROUP]: groupId,
  } as {
    [SpanMetricsField.SPAN_OP]: string;
    [SpanMetricsField.SPAN_DESCRIPTION]: string;
    [SpanMetricsField.SPAN_ACTION]: string;
    [SpanMetricsField.SPAN_DOMAIN]: string[];
    [SpanMetricsField.SPAN_GROUP]: string;
  };

  const {isLoading: areSpanMetricsSeriesLoading, data: spanMetricsSeriesData} =
    useSpanMetricsSeries(
      {'span.group': groupId, ...seriesQueryFilter},
      [`avg(${SpanMetricsField.SPAN_SELF_TIME})`, 'spm()', 'http_error_count()'],
      'api.starfish.span-summary-page-metrics-chart'
    );

  useSynchronizeCharts([!areSpanMetricsSeriesLoading]);

  const spanMetricsThroughputSeries = {
    seriesName: span?.[SpanMetricsField.SPAN_OP]?.startsWith('db')
      ? 'Queries'
      : 'Requests',
    data: spanMetricsSeriesData?.['spm()'].data,
  };

  return (
    <Fragment>
      <HeaderContainer>
        <FilterOptionsContainer>
          <StarfishDatePicker />
        </FilterOptionsContainer>

        <SpanMetricsRibbon spanMetrics={span} />
      </HeaderContainer>

      {span?.[SpanMetricsField.SPAN_DESCRIPTION] && (
        <DescriptionContainer>
          <SpanDescription
            groupId={groupId}
            op={spanMetrics[SpanMetricsField.SPAN_OP]}
            preliminaryDescription={spanMetrics[SpanMetricsField.SPAN_DESCRIPTION]}
          />
        </DescriptionContainer>
      )}

      <BlockContainer>
        <Block>
          <ChartPanel title={getThroughputChartTitle(span?.[SpanMetricsField.SPAN_OP])}>
            <Chart
              height={CHART_HEIGHT}
              data={[spanMetricsThroughputSeries]}
              loading={areSpanMetricsSeriesLoading}
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
              data={[spanMetricsSeriesData?.[`avg(${SpanMetricsField.SPAN_SELF_TIME})`]]}
              loading={areSpanMetricsSeriesLoading}
              chartColors={[AVG_COLOR]}
              isLineChart
              definedAxisTicks={4}
            />
          </ChartPanel>
        </Block>

        {span?.[SpanMetricsField.SPAN_OP]?.startsWith('http') && (
          <Block>
            <ChartPanel title={DataTitles.errorCount}>
              <Chart
                height={CHART_HEIGHT}
                data={[spanMetricsSeriesData?.[`http_error_count()`]]}
                loading={areSpanMetricsSeriesLoading}
                chartColors={[ERRORS_COLOR]}
                isLineChart
                definedAxisTicks={4}
              />
            </ChartPanel>
          </Block>
        )}
      </BlockContainer>
    </Fragment>
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
