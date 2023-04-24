import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';
import keyBy from 'lodash/keyBy';

import DateTime from 'sentry/components/dateTime';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {useApiQuery} from 'sentry/utils/queryClient';
import {SpanDurationBar} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/spanDetailsTable';
import {HOST} from 'sentry/views/starfish/modules/APIModule/APIModuleView';
import {getSpanInTransactionQuery} from 'sentry/views/starfish/modules/APIModule/queries';

import {getSpanSamplesQuery} from './queries';

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
];

type SpanTableRow = {
  exclusive_time: number;
  spanDuration: number;
  spanOp: string;
  span_id: string;
  timestamp: string;
  transactionDuration: number;
  transaction_id: string;
};

type Transaction = {
  duration: number;
  id: string;
  timestamp: string;
};

type Props = {
  location: Location;
} & RouteComponentProps<{slug: string}, {}>;

export default function SpanSummary({location, params}: Props) {
  const slug = parseSlug(params.slug);

  const {spanDescription, transactionName} = slug || {
    spanDescription: '',
    transactionName: '',
  };

  const query = getSpanInTransactionQuery(spanDescription, transactionName);

  const {isLoading, data} = useQuery({
    queryKey: ['spanSummary', spanDescription, transactionName],
    queryFn: () => fetch(`${HOST}/?query=${query}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const spanSamplesQuery = getSpanSamplesQuery(spanDescription, transactionName);
  const {isLoading: areSpanSamplesLoading, data: spanSampleData} = useQuery({
    queryKey: ['spanSamples', spanDescription, transactionName],
    queryFn: () => fetch(`${HOST}/?query=${spanSamplesQuery}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const {data: transactionData, isLoading: isTransactionDataLoading} = useApiQuery<{
    data: {data: Transaction[]};
  }>(
    [
      `/organizations/sentry/events/?field=id&field=timestamp&field=transaction.duration&query=id:[${spanSampleData
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

  if (!slug) {
    return <div>ERROR</div>;
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
            {isLoading ? (
              <span>LOADING</span>
            ) : (
              <KeyValueList
                data={[
                  {key: 'desc', value: spanDescription, subject: 'Description'},
                  {key: 'count', value: data?.[0]?.count, subject: 'Count'},
                  {key: 'p50', value: data?.[0]?.p50, subject: 'p50'},
                ]}
                shouldSort={false}
              />
            )}
            {areSpanSamplesLoading ? (
              <span>LOADING SAMPLE LIST</span>
            ) : (
              <div>
                <GridEditable
                  isLoading={isLoading || isTransactionDataLoading}
                  data={spanSampleData.map(datum => {
                    const transaction =
                      transactionDataById[datum.transaction_id.replaceAll('-', '')];

                    return {
                      transaction_id: datum.transaction_id,
                      span_id: datum.span_id,
                      timestamp: transaction?.timestamp,
                      spanOp: datum.span_operation,
                      spanDuration: datum.exclusive_time,
                      transactionDuration: transaction?.['transaction.duration'],
                    };
                  })}
                  columnOrder={COLUMN_ORDER}
                  columnSortBy={[]}
                  grid={{
                    renderHeadCell,
                    renderBodyCell: (column: GridColumnHeader, row: SpanTableRow) =>
                      renderBodyCell(column, row),
                  }}
                  location={location}
                />
              </div>
            )}
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}

function renderHeadCell(column: GridColumnHeader): React.ReactNode {
  return <OverflowEllipsisTextContainer>{column.name}</OverflowEllipsisTextContainer>;
}

export const OverflowEllipsisTextContainer = styled('span')`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;

function renderBodyCell(column: GridColumnHeader, row: SpanTableRow): React.ReactNode {
  if (column.key === 'transaction_id') {
    return (
      <Link
        to={`/performance/sentry:${row.transaction_id}#span-${row.span_id
          .slice(19)
          .replace('-', '')}`}
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

  if (column.key === 'timestamp') {
    return <DateTime date={row.timestamp} year timeZone seconds />;
  }

  return <span>{row[column.key]}</span>;
}

type SpanInTransactionSlug = {
  spanDescription: string;
  transactionName: string;
};

function parseSlug(slug?: string): SpanInTransactionSlug | undefined {
  if (!slug) {
    return undefined;
  }

  const delimiterPosition = slug.lastIndexOf(':');
  if (delimiterPosition < 0) {
    return undefined;
  }

  const spanDescription = slug.slice(0, delimiterPosition);
  const transactionName = slug.slice(delimiterPosition + 1);

  return {spanDescription, transactionName};
}
