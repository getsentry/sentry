import React, {useState} from 'react';
import {RouteComponentProps} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';
import keyBy from 'lodash/keyBy';
import moment from 'moment';

import DatePageFilter from 'sentry/components/datePageFilter';
import DateTime from 'sentry/components/dateTime';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import SwitchButton from 'sentry/components/switchButton';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {useApiQuery} from 'sentry/utils/queryClient';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SpanDurationBar} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/spanDetailsTable';
import Chart from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {FormattedCode} from 'sentry/views/starfish/components/formattedCode';
import {TextAlignRight} from 'sentry/views/starfish/modules/APIModule/endpointTable';
import {highlightSql} from 'sentry/views/starfish/modules/databaseModule/panel';
import {useQueryTransactionByTPMAndDuration} from 'sentry/views/starfish/modules/databaseModule/queries';
import {getDateFilters, PERIOD_REGEX} from 'sentry/views/starfish/utils/dates';
import Sidebar, {
  getTransactionBasedSeries,
  queryDataToChartData,
} from 'sentry/views/starfish/views/spanSummary/sidebar';

import {
  useQueryGetSpanSamples,
  useQueryGetSpanSeriesData,
  useQuerySpansInTransaction,
} from './queries';

const COLUMN_ORDER = [
  {
    key: 'transaction_id',
    name: 'Event ID',
    width: 200,
  },
  {
    key: 'timestamp',
    name: 'Timestamp',
    width: 300,
  },
  {
    key: 'duration',
    name: 'Span Duration',
    width: 200,
  },
  {
    key: 'p50_comparison',
    name: 'Compared to P50',
    width: 200,
  },
];

type SpanTableRow = {
  exclusive_time: number;
  p50Comparison: number;
  'project.name': string;
  spanDuration: number;
  spanOp: string;
  span_id: string;
  timestamp: string;
  transaction: string;
  transactionDuration: number;
  transaction_id: string;
  user: string;
};

type Transaction = {
  duration: number;
  id: string;
  timestamp: string;
};

type Props = {
  location: Location;
} & RouteComponentProps<{groupId: string}, {}>;

type State = {
  megaChart?: boolean;
  plotSamples?: boolean;
};

export default function SpanSummary({location, params}: Props) {
  const [state, setState] = useState<State>({
    plotSamples: false,
    megaChart: false,
  });
  const pageFilter = usePageFilters();
  const theme = useTheme();

  const dateFilter = getDateFilters(pageFilter);

  const groupId: string = params.groupId;
  const transactionName: string = location.query.transaction;
  const user: string = location.query.user;

  const {isLoading, data} = useQuerySpansInTransaction({groupId});

  const p50 = data[0]?.p50 ?? 0;

  const results = useQueryGetSpanSamples({groupId, transactionName, user, p50});

  const {isLoading: areSpanSamplesLoading, data: spanSampleData} = results.reduce(
    (acc: {data: any[]; isLoading: boolean; spanIds: Set<string>}, result) => {
      if (result.isLoading) {
        acc.isLoading = true;
        return acc;
      }

      // Ensures that the same span is not added twice, since there could be overlap in the case of sparse data
      result.data.forEach(datum => {
        if (!acc.spanIds.has(datum.span_id)) {
          acc.spanIds.add(datum.span_id);
          acc.data.push(datum);
        }
      });

      return acc;
    },
    {isLoading: false, data: [], spanIds: new Set<string>()}
  );

  const spanDescription = spanSampleData?.[0]?.description;
  const spanDomain = spanSampleData?.[0]?.domain;
  const spanGroupOperation = data?.[0]?.span_operation;
  const spanAction = data?.[0]?.action;
  const module = data?.[0]?.module;
  const formattedDescription = data?.[0]?.formatted_desc;
  const action = data?.[0]?.action;

  const {isLoading: isLoadingSeriesData, data: seriesData} = useQueryGetSpanSeriesData({
    groupId,
    spanGroupOperation,
    transactionName,
    description: spanDescription,
    module,
  });

  const [_, num, unit] = pageFilter.selection.datetime.period?.match(PERIOD_REGEX) ?? [];
  const startTime =
    num && unit
      ? moment().subtract(num, unit as 'h' | 'd')
      : moment(pageFilter.selection.datetime.start);
  const endTime = moment(pageFilter.selection.datetime.end ?? undefined);

  const {isLoading: isTransactionAggregateDataLoading, data: transactionAggregateData} =
    useQueryTransactionByTPMAndDuration([transactionName], 12);

  const {p50TransactionSeries, throughputTransactionSeries} = getTransactionBasedSeries(
    transactionAggregateData,
    dateFilter
  );
  const {
    p50: p50Series,
    spm: spmSeries,
    failure_count: _errorCountSeries,
  } = queryDataToChartData(seriesData, startTime, endTime, {lineStyle: {type: 'dotted'}});

  const {data: transactionData, isLoading: isTransactionDataLoading} = useApiQuery<{
    data: {data: Transaction[]};
  }>(
    [
      `/organizations/sentry/events/?field=id&field=timestamp&field=transaction.duration&field=project.name&query=id:[${spanSampleData
        .map(datum => datum.transaction_id.replaceAll('-', ''))
        .join(
          ','
        )}]&referrer=api.starfish.span-summary-table&sort=-transaction.duration&statsPeriod=14d`,
    ],
    {
      staleTime: 0,
      enabled: spanSampleData.length > 0,
    }
  );

  const transactionDataById = keyBy(transactionData?.data, 'id') as unknown as {
    [key: Transaction['id']]: Transaction;
  };

  const sampledSpanData: SpanTableRow[] = spanSampleData.map(datum => {
    const transaction = transactionDataById[datum.transaction_id.replaceAll('-', '')];

    return {
      transaction: datum.transaction,
      transaction_id: datum.transaction_id,
      'project.name': transaction?.['project.name'],
      span_id: datum.span_id,
      timestamp: transaction?.timestamp,
      spanOp: datum.span_operation,
      spanDuration: datum.exclusive_time,
      transactionDuration: transaction?.['transaction.duration'],
      exclusive_time: datum.exclusive_time,
      p50Comparison: datum.p50_comparison,
      user: datum.user,
    };
  });

  const sampledSpanDataSeries = sampledSpanData.map(({timestamp, spanDuration}) => ({
    name: timestamp,
    value: spanDuration,
  }));

  function renderHeadCell(column: GridColumnHeader): React.ReactNode {
    if (column.key === 'p50_comparison') {
      return (
        <TextAlignRight>
          <OverflowEllipsisTextContainer>{column.name}</OverflowEllipsisTextContainer>
        </TextAlignRight>
      );
    }

    return <OverflowEllipsisTextContainer>{column.name}</OverflowEllipsisTextContainer>;
  }

  function renderBodyCell(column: GridColumnHeader, row: SpanTableRow): React.ReactNode {
    if (column.key === 'transaction_id') {
      return (
        <Link
          to={`/performance/${row['project.name']}:${
            row.transaction_id
          }#span-${row.span_id.slice(19).replace('-', '')}`}
        >
          {row.transaction_id.slice(0, 8)}
        </Link>
      );
    }

    if (column.key === 'duration') {
      return (
        <SpanDurationBar
          spanOp={row.spanOp}
          spanDuration={row.spanDuration}
          transactionDuration={row.transactionDuration}
        />
      );
    }

    if (column.key === 'p50_comparison') {
      const diff = row.spanDuration - p50;

      if (Math.floor(row.spanDuration) === Math.floor(p50)) {
        return <PlaintextLabel>{t('At baseline')}</PlaintextLabel>;
      }

      const labelString =
        diff > 0 ? `+${diff.toFixed(2)}ms above` : `${diff.toFixed(2)}ms below`;

      return <ComparisonLabel value={diff}>{labelString}</ComparisonLabel>;
    }

    if (column.key === 'timestamp') {
      return <DateTime date={row.timestamp} year timeZone seconds />;
    }

    return <span>{row[column.key]}</span>;
  }

  return (
    <Layout.Page>
      <PageErrorProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{transactionName}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>
            <PageErrorAlert />
            <FilterOptionsContainer>
              <DatePageFilter alignDropdown="left" />
              <FilterOptionsSubContainer>
                <ToggleLabel active={state.plotSamples}>
                  {t('Plot samples on charts')}
                </ToggleLabel>
                <SwitchButton
                  isActive={state.plotSamples}
                  toggle={() => {
                    setState({...state, plotSamples: !state.plotSamples});
                  }}
                />
              </FilterOptionsSubContainer>
            </FilterOptionsContainer>
            <FlexContainer>
              <MainSpanSummaryContainer>
                {isLoading ? (
                  <span>LOADING</span>
                ) : (
                  <div>
                    <h3>{t('Info')}</h3>
                    <SpanGroupKeyValueList
                      data={data}
                      spanAction={spanAction}
                      spanGroupOperation={spanGroupOperation}
                      spanDescription={spanDescription}
                      formattedDescription={formattedDescription}
                      spanDomain={spanDomain}
                      action={action}
                      transactionName={transactionName}
                    />
                  </div>
                )}

                <ChartGrid>
                  <ChartPanel title={t('Throughput (TPM)')}>
                    <Chart
                      statsPeriod="24h"
                      height={140}
                      data={[throughputTransactionSeries ?? []]}
                      start=""
                      end=""
                      loading={isTransactionAggregateDataLoading}
                      utc={false}
                      stacked
                      isLineChart
                      disableXAxis
                      definedAxisTicks={4}
                    />
                  </ChartPanel>

                  <ChartPanel title={t('Transaction Duration (P50)')}>
                    <Chart
                      statsPeriod="24h"
                      height={140}
                      chartColors={theme.charts.getColorPalette(4).slice(5, 6)}
                      data={[p50TransactionSeries ?? []]}
                      start=""
                      end=""
                      loading={isTransactionAggregateDataLoading}
                      utc={false}
                      stacked
                      isLineChart
                      disableXAxis
                      definedAxisTicks={4}
                    />
                  </ChartPanel>

                  <ChartPanel title={t('Throughput (SPM)')}>
                    <Chart
                      statsPeriod="24h"
                      height={140}
                      data={[spmSeries ?? []]}
                      start=""
                      end=""
                      loading={isLoadingSeriesData}
                      utc={false}
                      stacked
                      isLineChart
                      disableXAxis
                      definedAxisTicks={4}
                    />
                  </ChartPanel>

                  <ChartPanel title={t('Span Duration (P50)')}>
                    <Chart
                      statsPeriod="24h"
                      height={140}
                      data={[p50Series ?? []]}
                      start=""
                      end=""
                      loading={isLoadingSeriesData}
                      utc={false}
                      chartColors={theme.charts.getColorPalette(4).slice(5, 6)}
                      scatterPlot={
                        state.plotSamples
                          ? [
                              {
                                data: sampledSpanDataSeries,
                                seriesName: 'Sampled Span Duration',
                              },
                            ]
                          : undefined
                      }
                      stacked
                      isLineChart
                      disableXAxis
                      definedAxisTicks={4}
                    />
                  </ChartPanel>
                </ChartGrid>

                {areSpanSamplesLoading ? (
                  <span>LOADING SAMPLE LIST</span>
                ) : (
                  <div>
                    <GridEditable
                      isLoading={isLoading || isTransactionDataLoading}
                      data={sampledSpanData}
                      columnOrder={COLUMN_ORDER}
                      columnSortBy={[]}
                      grid={{
                        renderHeadCell,
                        renderBodyCell,
                      }}
                      location={location}
                    />
                  </div>
                )}
              </MainSpanSummaryContainer>
              <SidebarContainer>
                <Sidebar
                  groupId={groupId}
                  spanGroupOperation={spanGroupOperation}
                  transactionName={transactionName}
                  sampledSpanData={state.plotSamples ? sampledSpanData : []}
                  module={module}
                />
              </SidebarContainer>
            </FlexContainer>
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}

export const OverflowEllipsisTextContainer = styled('span')`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;

const FlexContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(4)};
`;

const MainSpanSummaryContainer = styled('div')`
  flex: 100 0 800px;
`;

const SidebarContainer = styled('div')`
  flex: 1 1 500px;
`;

const FilterOptionsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  align-items: center;
  margin-bottom: ${space(2)};
`;

const FilterOptionsSubContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  align-items: center;
  flex: 1;
  justify-content: flex-end;
`;

const ToggleLabel = styled('span')<{active?: boolean}>`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => (p.active ? p.theme.purple300 : p.theme.gray300)};
`;

const PlaintextLabel = styled('div')`
  text-align: right;
`;

const ComparisonLabel = styled('div')<{value: number}>`
  text-align: right;
  color: ${p => (p.value < 0 ? p.theme.green400 : p.theme.red400)};
`;

const ChartGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  column-gap: ${space(1.5)};
`;

function SpanGroupKeyValueList({
  spanAction,
  spanDescription,
  spanGroupOperation,
  spanDomain,
  formattedDescription,
  action,
}: {
  data: any;
  formattedDescription: string;
  spanAction: string;
  // TODO: type this
  spanDescription: string;
  action?: string;
  spanDomain?: string;
  spanGroupOperation?: string;
  transactionName?: string;
}) {
  if (formattedDescription && action && spanDomain) {
    highlightSql(formattedDescription, {action, domain: spanDomain});
  }
  switch (spanGroupOperation) {
    case 'db':
    case 'cache':
      return (
        <KeyValueList
          data={[
            {
              key: 'op',
              value: spanGroupOperation,
              subject: 'Operation',
            },
            {
              key: 'desc',
              value:
                action && spanDomain ? (
                  <FormattedCode>
                    {highlightSql(formattedDescription, {action, domain: spanDomain})}
                  </FormattedCode>
                ) : (
                  formattedDescription
                ),
              subject: 'Query',
            },
          ]}
          shouldSort={false}
        />
      );
    case 'http.client':
      return (
        <KeyValueList
          data={[
            {
              key: 'op',
              value: spanGroupOperation,
              subject: 'Operation',
            },
            {
              key: 'action',
              value: spanAction,
              subject: 'HTTP Method',
            },
            {key: 'desc', value: spanDescription, subject: 'URL'},
          ]}
          shouldSort={false}
        />
      );
    default:
      return null;
  }
}
