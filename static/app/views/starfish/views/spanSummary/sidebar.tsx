import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import moment from 'moment';

import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatPercentage} from 'sentry/utils/formatters';
import usePageFilters from 'sentry/utils/usePageFilters';
import Chart from 'sentry/views/starfish/components/chart';
import {
  getEndpointDetailSeriesQuery,
  getEndpointDetailTableQuery,
} from 'sentry/views/starfish/modules/APIModule/queries';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {PERIOD_REGEX} from 'sentry/views/starfish/utils/dates';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';
import {
  getOverallAggregatesQuery,
  getSidebarAggregatesQuery,
  getSidebarSeriesQuery,
  getUniqueTransactionCountQuery,
} from 'sentry/views/starfish/views/spanSummary/queries';

export default function Sidebar({
  spanGroupOperation,
  groupId,
  description,
  transactionName,
  sampledSpanData,
}) {
  const theme = useTheme();
  const pageFilter = usePageFilters();
  const {getSeriesQuery, getAggregatesQuery} = getQueries(spanGroupOperation);
  const module = spanGroupOperation;
  const seriesQuery = getSeriesQuery({
    description,
    transactionName,
    datetime: pageFilter.selection.datetime,
    groupId,
    module,
  });
  const aggregatesQuery = getAggregatesQuery({
    description,
    transactionName,
    datetime: pageFilter.selection.datetime,
    groupId,
    module,
  });

  // This is supposed to a metrics span query that fetches aggregate metric data
  const {isLoading: _isLoadingSideBarAggregateData, data: spanAggregateData} = useQuery({
    queryKey: ['span-aggregates'],
    queryFn: () =>
      fetch(`${HOST}/?query=${aggregatesQuery}&referrer=sidebar-aggregates`).then(res =>
        res.json()
      ),
    retry: false,
    initialData: [],
  });

  const {isLoading: _isLoadingSideBarOverallAggregateData, data: overallAggregateData} =
    useQuery({
      queryKey: ['overall-aggregates'],
      queryFn: () =>
        fetch(
          `${HOST}/?query=${getOverallAggregatesQuery(
            pageFilter.selection.datetime
          )}&referrer=overall-aggregates`
        ).then(res => res.json()),
      retry: false,
      initialData: [],
    });

  // Also a metrics span query that fetches series data
  const {isLoading: isLoadingSeriesData, data: seriesData} = useQuery({
    queryKey: ['seriesdata'],
    queryFn: () => fetch(`${HOST}/?query=${seriesQuery}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  // This is a metrics request on transactions data!
  // We're fetching the count of events on a specific transaction so we can
  // calculate span frequency using metrics spans vs metrics transactions
  const countUniqueQuery = getUniqueTransactionCountQuery({
    transactionName,
    datetime: pageFilter.selection.datetime,
  });
  const {data: transactionData, isLoading: _isTransactionDataLoading} = useQuery({
    queryKey: [countUniqueQuery],
    queryFn: () =>
      fetch(`/api/0/organizations/sentry/events/${countUniqueQuery}`).then(res =>
        res.json()
      ),
    retry: false,
    initialData: [],
  });

  const {
    p50,
    p95,
    failure_rate,
    count,
    total_exclusive_time,
    count_unique_transaction_id,
    count_unique_transaction,
    first_seen,
    last_seen,
  } = spanAggregateData[0] || {};

  const {count_overall_unique_transactions, overall_total_exclusive_time} =
    overallAggregateData[0] || {};

  const [_, num, unit] = pageFilter.selection.datetime.period?.match(PERIOD_REGEX) ?? [];
  const startTime =
    num && unit
      ? moment().subtract(num, unit as 'h' | 'd')
      : moment(pageFilter.selection.datetime.start);
  const endTime = moment(pageFilter.selection.datetime.end ?? undefined);

  const [p50Series, p95Series, countSeries, _errorCountSeries, errorRateSeries] =
    queryDataToChartData(seriesData).map(series =>
      zeroFillSeries(series, moment.duration(12, 'hours'), startTime, endTime)
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
  const sampledSpanDataSeries = sampledSpanData.map(({timestamp, spanDuration}) => ({
    name: timestamp,
    value: spanDuration,
  }));

  return (
    <FlexContainer>
      <FlexItem>
        <SidebarItemHeader>{t('Total Self Time')}</SidebarItemHeader>
        <SidebarItemValueContainer>
          <Duration seconds={total_exclusive_time / 1000} fixedDigits={2} abbreviation />{' '}
          ({formatPercentage(total_exclusive_time / overall_total_exclusive_time)})
        </SidebarItemValueContainer>
      </FlexItem>
      <FlexItem>
        <SidebarItemHeader>{t('Unique Transactions')}</SidebarItemHeader>
        <SidebarItemValueContainer>
          {count_unique_transaction} / {count_overall_unique_transactions}
        </SidebarItemValueContainer>
      </FlexItem>
      <FlexItem>
        <SidebarItemHeader>{t('First Seen')}</SidebarItemHeader>
        <SidebarItemValueContainer>
          <DateTime date={first_seen} timeZone seconds utc />
        </SidebarItemValueContainer>
      </FlexItem>
      <FlexItem>
        <SidebarItemHeader>{t('Last Seen')}</SidebarItemHeader>
        <SidebarItemValueContainer>
          <DateTime date={last_seen} timeZone seconds utc />
        </SidebarItemValueContainer>
      </FlexItem>
      <FlexItem>
        <SidebarItemHeader>{t('Total Spans')}</SidebarItemHeader>
        <SidebarItemValueContainer>{count}</SidebarItemValueContainer>
      </FlexItem>
      <FlexItem>
        <SidebarItemHeader>{t('Span Frequency')}</SidebarItemHeader>
        <SidebarItemValueContainer>
          {formatPercentage(spanFrequency)}
        </SidebarItemValueContainer>
      </FlexItem>
      <FlexItem>
        <SidebarItemHeader>{t('Spans Per Event')}</SidebarItemHeader>
        <SidebarItemValueContainer>{spansPerEvent}</SidebarItemValueContainer>
      </FlexItem>
      <FlexFullWidthItem>
        <SidebarItemHeader>{t('Throughput')}</SidebarItemHeader>
        <SidebarItemValueContainer>{count}</SidebarItemValueContainer>
        <SidebarChart
          series={countSeries}
          isLoading={isLoadingSeriesData}
          chartColor={chartColors[0]}
        />
      </FlexFullWidthItem>
      <FlexFullWidthItem>
        <SidebarItemHeader>{t('Duration P50 / P95')}</SidebarItemHeader>
        <SidebarItemValueContainer>
          <Duration seconds={p50 / 1000} fixedDigits={2} abbreviation /> /
          <Duration seconds={p95 / 1000} fixedDigits={2} abbreviation />
        </SidebarItemValueContainer>
        <Chart
          statsPeriod="24h"
          height={140}
          data={[p50Series ?? [], p95Series ?? []]}
          start=""
          end=""
          loading={isLoadingSeriesData}
          utc={false}
          chartColors={theme.charts.getColorPalette(4).slice(3, 5)}
          scatterPlot={[
            {data: sampledSpanDataSeries, seriesName: 'Sampled Span Duration'},
          ]}
          stacked
          isLineChart
          disableXAxis
          hideYAxisSplitLine
        />
      </FlexFullWidthItem>
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

function SidebarChart(props) {
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

function queryDataToChartData(data: any) {
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

function getQueries(spanGroupOperation: string) {
  switch (spanGroupOperation) {
    case 'db':
    case 'cache':
      return {
        getSeriesQuery: getSidebarSeriesQuery,
        getAggregatesQuery: getSidebarAggregatesQuery,
      };
    case 'http.client':
      return {
        getSeriesQuery: getEndpointDetailSeriesQuery,
        getAggregatesQuery: getEndpointDetailTableQuery,
      };
    default:
      return {
        getSeriesQuery: getSidebarSeriesQuery,
        getAggregatesQuery: getSidebarAggregatesQuery,
      };
  }
}
