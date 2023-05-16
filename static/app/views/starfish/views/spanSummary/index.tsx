import React, {useState} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';
import keyBy from 'lodash/keyBy';
import orderBy from 'lodash/orderBy';
import * as qs from 'query-string';

import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import DatePageFilter from 'sentry/components/datePageFilter';
import DateTime from 'sentry/components/dateTime';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import SwitchButton from 'sentry/components/switchButton';
import TagDistributionMeter from 'sentry/components/tagDistributionMeter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {useApiQuery} from 'sentry/utils/queryClient';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SpanDurationBar} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/spanDetailsTable';
import {TextAlignRight} from 'sentry/views/starfish/modules/APIModule/endpointTable';
import {
  getSpanFacetBreakdownQuery,
  getSpanInTransactionQuery,
} from 'sentry/views/starfish/modules/APIModule/queries';
import {HOST} from 'sentry/views/starfish/utils/constants';
import MegaChart from 'sentry/views/starfish/views/spanSummary/megaChart';
import Sidebar from 'sentry/views/starfish/views/spanSummary/sidebar';

import {getSpanSamplesQuery} from './queries';

const COLUMN_ORDER = [
  {
    key: 'transaction_id',
    name: 'Event ID',
    width: 200,
  },
  {
    key: 'transaction',
    name: 'Transaction',
    width: 200,
  },
  {
    key: 'user',
    name: 'User',
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
  selectedOption: SelectOption<string>;
  megaChart?: boolean;
  plotSamples?: boolean;
};

const options = [
  {label: 'Slowest Samples', value: 'slowest_samples'},
  {label: 'Fastest Samples', value: 'fastest_samples'},
  {label: 'Median Samples', value: 'median_samples'},
];

export default function SpanSummary({location, params}: Props) {
  const [state, setState] = useState<State>({
    plotSamples: false,
    megaChart: false,
    selectedOption: options[0],
  });
  const pageFilter = usePageFilters();

  const handleDropdownChange = (option: SelectOption<string>) => {
    setState({...state, selectedOption: option});
  };

  const groupId = params.groupId;
  const transactionName = location.query.transaction;
  const user = location.query.user;

  const spanInfoQuery = getSpanInTransactionQuery({
    groupId,
    datetime: pageFilter.selection.datetime,
  });

  const {isLoading, data} = useQuery({
    queryKey: ['spanSummary', groupId],
    queryFn: () => fetch(`${HOST}/?query=${spanInfoQuery}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const p50 = data[0]?.p50 ?? 0;
  const facetBreakdownQuery = getSpanFacetBreakdownQuery({
    groupId,
    datetime: pageFilter.selection.datetime,
  });

  const {isLoading: isFacetBreakdownLoading, data: facetBreakdownData} = useQuery({
    queryKey: ['facetBreakdown', groupId],
    queryFn: () => fetch(`${HOST}/?query=${facetBreakdownQuery}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const spanSamplesQuery = getSpanSamplesQuery({
    groupId,
    transactionName,
    user,
    datetime: pageFilter.selection.datetime,
    sortBy: state.selectedOption.value,
    p50,
  });

  const {isLoading: areSpanSamplesLoading, data: spanSampleData} = useQuery({
    queryKey: [
      'spanSamples',
      groupId,
      transactionName,
      user,
      pageFilter.selection.datetime,
      state.selectedOption,
    ],
    queryFn: () => fetch(`${HOST}/?query=${spanSamplesQuery}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

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

  const spanDescription = spanSampleData?.[0]?.description;
  const spanDomain = spanSampleData?.[0]?.domain;

  const spanGroupOperation = data?.[0]?.span_operation;

  const sampledSpanData = spanSampleData.map(datum => {
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
    };
  });

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

      if (diff === p50) {
        return 'At baseline';
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
            <Layout.Title>{groupId}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>
            <PageErrorAlert />
            <FilterOptionsContainer>
              <DatePageFilter alignDropdown="left" />
              <FilterOptionsSubContainer>
                <ToggleLabel active={state.megaChart}>{t('Show mega chart')}</ToggleLabel>
                <SwitchButton
                  isActive={state.megaChart}
                  toggle={() => {
                    setState({...state, megaChart: !state.megaChart});
                  }}
                />
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
                      spanGroupOperation={spanGroupOperation}
                      spanDescription={spanDescription}
                      spanDomain={spanDomain}
                      transactionName={transactionName}
                    />
                  </div>
                )}
                {state.megaChart && (
                  <MegaChart
                    groupId={groupId}
                    spanGroupOperation={spanGroupOperation}
                    description={null}
                    transactionName={transactionName}
                    sampledSpanData={state.plotSamples ? sampledSpanData : []}
                  />
                )}
                {isFacetBreakdownLoading ? (
                  <span>LOADING</span>
                ) : (
                  <div>
                    <h3>{t('Facets')}</h3>
                    {['transaction', 'user'].map(facet => {
                      const values = facetBreakdownData.map(datum => datum[facet]);

                      const uniqueValues: string[] = Array.from(new Set(values));

                      let totalValues = 0;

                      const segments = orderBy(
                        uniqueValues.map(uniqueValue => {
                          const count = values.filter(v => v === uniqueValue).length;
                          totalValues += count;

                          return {
                            key: facet,
                            name: uniqueValue,
                            value: uniqueValue,
                            url: `/starfish/span/${groupId}?${qs.stringify({
                              [facet]: uniqueValue,
                            })}`,
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

                {areSpanSamplesLoading ? (
                  <span>LOADING SAMPLE LIST</span>
                ) : (
                  <div>
                    <h3>{t('Samples')}</h3>
                    <DropdownContainer>
                      <CompactSelect
                        options={options}
                        value={state.selectedOption.value}
                        onChange={handleDropdownChange}
                        menuWidth={250}
                        size="md"
                      />
                    </DropdownContainer>

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
                  description={null}
                  transactionName={transactionName}
                  sampledSpanData={state.plotSamples ? sampledSpanData : []}
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
  flex: 1 1 300px;
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

const ComparisonLabel = styled('div')<{value: number}>`
  text-align: right;
  color: ${p => (p.value < 0 ? p.theme.green400 : p.theme.red400)};
`;

const DropdownContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

function SpanGroupKeyValueList({
  spanDescription,
  spanGroupOperation,
  spanDomain,
}: {
  data: any; // TODO: type this
  spanDescription: string;
  spanDomain?: string;
  spanGroupOperation?: string;
  transactionName?: string;
}) {
  switch (spanGroupOperation) {
    case 'db':
    case 'cache':
      return (
        <KeyValueList
          data={[
            {key: 'desc', value: spanDescription, subject: 'Full Query'},
            {key: 'domain', value: spanDomain, subject: 'Table Columns'},
          ]}
          shouldSort={false}
        />
      );
    case 'http.client':
      return (
        <KeyValueList
          data={[
            {key: 'desc', value: spanDescription, subject: 'URL'},
            {key: 'domain', value: spanDomain, subject: 'Domain'},
          ]}
          shouldSort={false}
        />
      );
    default:
      return null;
  }
}
