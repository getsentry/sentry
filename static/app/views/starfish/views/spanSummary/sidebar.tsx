import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import moment from 'moment';

import Duration from 'sentry/components/duration';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {formatPercentage} from 'sentry/utils/formatters';
import usePageFilters from 'sentry/utils/usePageFilters';
import Chart from 'sentry/views/starfish/components/chart';
import {HOST} from 'sentry/views/starfish/modules/APIModule/APIModuleView';
import {
  getEndpointDetailSeriesQuery,
  getEndpointDetailTableQuery,
} from 'sentry/views/starfish/modules/APIModule/queries';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';
import {getUniqueTransactionCountQuery} from 'sentry/views/starfish/views/spanSummary/queries';

export default function Sidebar({description, transactionName}) {
  const theme = useTheme();
  const pageFilter = usePageFilters();
  const seriesQuery = getEndpointDetailSeriesQuery({
    description,
    transactionName,
    datetime: pageFilter.selection.datetime,
  });
  const aggregatesQuery = getEndpointDetailTableQuery({
    description,
    transactionName,
    datetime: pageFilter.selection.datetime,
  });

  // This is supposed to a metrics span query that fetches aggregate metric data
  const {isLoading: _isLoadingSideBarAggregateData, data: aggregateData} = useQuery({
    queryKey: [aggregatesQuery],
    queryFn: () => fetch(`${HOST}/?query=${aggregatesQuery}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  // Also a metrics span query that fetches series data
  const {isLoading: isLoadingSeriesData, data: seriesData} = useQuery({
    queryKey: [seriesQuery],
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
  } = aggregateData[0] || {};

  const [p50Series, p95Series, countSeries, _errorCountSeries, errorRateSeries] =
    queryDataToChartData(seriesData).map(series =>
      zeroFillSeries(series, moment.duration(12, 'hours'))
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
        <SidebarItemHeader>{t('Total Self Time')}</SidebarItemHeader>
        <SidebarItemValueContainer>
          <Duration seconds={total_exclusive_time / 1000} fixedDigits={2} abbreviation />
        </SidebarItemValueContainer>
      </FlexItem>
      <FlexItem>
        <SidebarItemHeader>{t('Total Events')}</SidebarItemHeader>
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
        <SidebarItemHeader>{t('Self Time Duration (P50)')}</SidebarItemHeader>
        <SidebarItemValueContainer>
          <Duration seconds={p50 / 1000} fixedDigits={2} abbreviation />
        </SidebarItemValueContainer>
        <SidebarChart
          series={p50Series}
          isLoading={isLoadingSeriesData}
          chartColor={chartColors[1]}
        />
      </FlexFullWidthItem>
      <FlexFullWidthItem>
        <SidebarItemHeader>{t('Self Time Duration (P95)')}</SidebarItemHeader>
        <SidebarItemValueContainer>
          <Duration seconds={p95 / 1000} fixedDigits={2} abbreviation />
        </SidebarItemValueContainer>
        <SidebarChart
          series={p95Series}
          isLoading={isLoadingSeriesData}
          chartColor={chartColors[2]}
        />
      </FlexFullWidthItem>
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
      disableMultiAxis
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
