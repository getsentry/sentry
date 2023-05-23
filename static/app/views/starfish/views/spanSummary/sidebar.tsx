import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import orderBy from 'lodash/orderBy';
import moment, {Moment} from 'moment';
import * as qs from 'query-string';

import Duration from 'sentry/components/duration';
import TagDistributionMeter from 'sentry/components/tagDistributionMeter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatPercentage} from 'sentry/utils/formatters';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import Chart from 'sentry/views/starfish/components/chart';
import {queryToSeries} from 'sentry/views/starfish/modules/databaseModule/utils';
import {PERIOD_REGEX} from 'sentry/views/starfish/utils/dates';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';
import {
  useQueryGetFacetsBreakdown,
  useQueryGetSpanAggregatesQuery,
  useQueryGetSpanSeriesData,
  useQueryGetUniqueTransactionCount,
} from 'sentry/views/starfish/views/spanSummary/queries';

type Props = {
  groupId: string;
  sampledSpanData: any;
  spanGroupOperation: string;
  transactionName: string;
  description?: string;
  module?: string;
};

export default function Sidebar({
  spanGroupOperation,
  groupId,
  description,
  transactionName,
  module,
}: Props) {
  const theme = useTheme();
  const pageFilter = usePageFilters();
  const location = useLocation();

  const {isLoading: isFacetBreakdownLoading, data: facetBreakdownData} =
    useQueryGetFacetsBreakdown({groupId, transactionName});

  // This is supposed to a metrics span query that fetches aggregate metric data
  const {isLoading: _isLoadingSideBarAggregateData, data: spanAggregateData} =
    useQueryGetSpanAggregatesQuery({
      description,
      groupId,
      module,
      transactionName,
    });

  // Also a metrics span query that fetches series data
  const {isLoading: isLoadingSeriesData, data: seriesData} = useQueryGetSpanSeriesData({
    description,
    groupId,
    module,
    spanGroupOperation,
    transactionName,
  });

  // This is a metrics request on transactions data!
  // We're fetching the count of events on a specific transaction so we can
  // calculate span frequency using metrics spans vs metrics transactions
  const {data: transactionData, isLoading: _isTransactionDataLoading} =
    useQueryGetUniqueTransactionCount({transactionName});

  const {failure_rate, count, total_exclusive_time, count_unique_transaction_id} =
    spanAggregateData[0] || {};

  const [_, num, unit] = pageFilter.selection.datetime.period?.match(PERIOD_REGEX) ?? [];
  const startTime =
    num && unit
      ? moment().subtract(num, unit as 'h' | 'd')
      : moment(pageFilter.selection.datetime.start);
  const endTime = moment(pageFilter.selection.datetime.end ?? undefined);

  const [, , , _errorCountSeries, errorRateSeries] = queryDataToChartData(seriesData).map(
    series => zeroFillSeries(series, moment.duration(12, 'hours'), startTime, endTime)
  );

  // NOTE: This almost always calculates to 0.00% when using the scraped data.
  // This is because the scraped data doesn't have nearly as much volume as real prod data.
  const spanFrequency =
    count_unique_transaction_id && transactionData?.data?.[0]?.['count()']
      ? count_unique_transaction_id / transactionData.data[0]['count()']
      : 0;

  // Average spans per event is just the total number of metrics spans divided by the total number of events
  const spansPerEvent =
    Math.round(
      (count && transactionData?.data?.[0]?.['count()']
        ? count / transactionData.data[0]['count()']
        : 0) * 100
    ) / 100;

  const chartColors = theme.charts.getColorPalette(2);

  return (
    <FlexContainer>
      <FlexItem>
        <SidebarItemHeader>{t('Total Time')}</SidebarItemHeader>
        <SidebarItemValueContainer>
          <Duration seconds={total_exclusive_time / 1000} fixedDigits={2} abbreviation />{' '}
        </SidebarItemValueContainer>
      </FlexItem>
      <FlexItem>
        <SidebarItemHeader>{t('Total Spans')}</SidebarItemHeader>
        <SidebarItemValueContainer>{count}</SidebarItemValueContainer>
      </FlexItem>
      <FlexItem>
        <SidebarItemHeader>{t('Frequency')}</SidebarItemHeader>
        <SidebarItemValueContainer>
          {formatPercentage(spanFrequency)}
        </SidebarItemValueContainer>
      </FlexItem>
      <FlexItem>
        <SidebarItemHeader>{t('Avg Spans')}</SidebarItemHeader>
        <SidebarItemValueContainer>
          {spansPerEvent} {t('per event')}
        </SidebarItemValueContainer>
      </FlexItem>

      {
        // This could be better. Improve later.
        spanGroupOperation === 'http.client' && (
          <FlexFullWidthItem>
            <SidebarItemHeader>{t('Error Rate')}</SidebarItemHeader>
            <SidebarItemValueContainer>
              {formatPercentage(failure_rate)}
            </SidebarItemValueContainer>
            <SidebarChart
              series={errorRateSeries}
              isLoading={isLoadingSeriesData}
              chartColor={chartColors[3]}
            />
          </FlexFullWidthItem>
        )
      }
      <FlexFullWidthItem>
        {isFacetBreakdownLoading ? (
          <span>LOADING</span>
        ) : (
          <div>
            <h3>{t('Facets')}</h3>
            {['user'].map(facet => {
              const values = facetBreakdownData.map(datum => datum[facet]);

              const uniqueValues: string[] = Array.from(new Set(values));

              let totalValues = 0;

              const segments = orderBy(
                uniqueValues.map(uniqueValue => {
                  const valueCount = values.filter(v => v === uniqueValue).length;
                  totalValues += valueCount;

                  const newQuery = {...location.query, [facet]: uniqueValue};

                  return {
                    key: facet,
                    name: uniqueValue,
                    value: uniqueValue,
                    url: `/starfish/span/${groupId}?${qs.stringify(newQuery)}`,
                    count,
                  };
                }),
                'count',
                'desc'
              );

              return (
                <TagDistributionMeter
                  key={facet}
                  title={facet}
                  segments={segments}
                  totalValues={totalValues}
                />
              );
            })}
          </div>
        )}
      </FlexFullWidthItem>
    </FlexContainer>
  );
}

const FlexContainer = styled('div')`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
`;

const FlexItem = styled('div')`
  flex: 1 1 50%;
  margin-bottom: ${space(4)};
`;

const FlexFullWidthItem = styled('div')`
  flex: 1 1 100%;
  margin-bottom: ${space(4)};
`;

const SidebarItemHeader = styled('h3')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
  margin-bottom: ${space(0.5)};
`;

const SidebarItemValueContainer = styled('h4')`
  margin: 0;
  font-weight: normal;
`;

export function SidebarChart(props) {
  return (
    <Chart
      statsPeriod="24h"
      height={110}
      data={props.series ? [props.series] : []}
      start=""
      end=""
      loading={props.isLoading}
      utc={false}
      stacked
      isLineChart
      disableXAxis
      hideYAxisSplitLine
      chartColors={[props.chartColor]}
      grid={{
        left: '0',
        right: '0',
        top: '8px',
        bottom: '16px',
      }}
      scatterPlot={[
        {data: props.sampledSpanDataSeries, seriesName: 'Sampled Span Duration'},
      ]}
    />
  );
}

export function queryDataToChartData(data: any) {
  const series = [] as any[];
  if (data.length > 0) {
    Object.keys(data[0])
      .filter(key => key !== 'interval')
      .forEach(key => {
        series.push({seriesName: `${key}()`, data: [] as any[]});
      });
  }
  data.forEach(point => {
    Object.keys(point).forEach(key => {
      if (key !== 'interval') {
        series
          .find(serie => serie.seriesName === `${key}()`)
          ?.data.push({
            name: point.interval,
            value: point[key],
          });
      }
    });
  });
  return series;
}

export const getTransactionBasedSeries = (
  data: any[],
  dateFilter: {endTime: Moment; startTime: Moment}
) => {
  const p50TransactionSeries = queryToSeries(
    data,
    'group',
    'p50(transaction.duration)',
    dateFilter.startTime,
    dateFilter.endTime,
    12
  )[0];

  const p95TransactionSeries = queryToSeries(
    data,
    'group',
    'p95(transaction.duration)',
    dateFilter.startTime,
    dateFilter.endTime,
    12
  )[0];

  const throughputTransactionSeries = queryToSeries(
    data,
    'group',
    'epm()',
    dateFilter.startTime,
    dateFilter.endTime,
    12
  )[0];
  if (data.length) {
    p50TransactionSeries.seriesName = 'p50()';
    p95TransactionSeries.seriesName = 'p95()';
    throughputTransactionSeries.seriesName = 'epm()';
  }

  return {p50TransactionSeries, p95TransactionSeries, throughputTransactionSeries};
};
