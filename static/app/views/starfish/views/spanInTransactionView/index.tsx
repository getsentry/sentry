import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {HOST} from 'sentry/views/starfish/modules/APIModule/APIModuleView';
import {getSpanInTransactionQuery} from 'sentry/views/starfish/modules/APIModule/queries';

import {getSpanSamplesQuery} from './queries';

const COLUMN_ORDER = [
  {
    key: 'transaction_id',
    name: 'Event ID',
    width: 600,
  },
];

type EventsDataRow = {
  transaction_id: string;
};

type Props = {
  location: Location;
} & RouteComponentProps<{slug: string}, {}>;

export default function SpanInTransactionView({location, params}: Props) {
  const slug = parseSlug(params.slug);

  const {spanDescription, transactionName} = slug || {
    spanDescription: '',
    transactionName: '',
  };

  const query = getSpanInTransactionQuery(spanDescription, transactionName);

  const {isLoading, data} = useQuery({
    queryKey: ['spanInTransaction', spanDescription, transactionName],
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
            <h2>Span Description</h2>
            Description: {spanDescription}
            {isLoading ? (
              <span>LOADING</span>
            ) : (
              <div>
                <h2>Span Stats</h2>
                <span>Count: {data?.[0]?.count}</span>
                <br />
                <span>p50: {data?.[0]?.p50}</span>
              </div>
            )}
            {areSpanSamplesLoading ? (
              <span>LOADING SAMPLE LIST</span>
            ) : (
              <div>
                <GridEditable
                  isLoading={isLoading}
                  data={spanSampleData}
                  columnOrder={COLUMN_ORDER}
                  columnSortBy={[]}
                  grid={{
                    renderHeadCell,
                    renderBodyCell: (column: GridColumnHeader, row: EventsDataRow) =>
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

function renderBodyCell(column: GridColumnHeader, row: EventsDataRow): React.ReactNode {
  if (column.key === 'transaction_id') {
    return (
      <Link to={`/performance/sentry:${row.transaction_id}`}>
        {row.transaction_id.slice(0, 8)}
      </Link>
    );
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
