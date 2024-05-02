import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import type {Location} from 'history';

import type {GridColumnHeader} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import Pagination, {type CursorHandler} from 'sentry/components/pagination';
import {ROW_HEIGHT, ROW_PADDING} from 'sentry/components/performance/waterfall/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, Project} from 'sentry/types';
import EventView, {type MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {ColumnType} from 'sentry/utils/discover/fields';
import {
  type DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {SpanDurationBar} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/spanDetailsTable';
import {useSpanSummarySort} from 'sentry/views/performance/transactionSummary/transactionSpans/spanSummary/useSpanSummarySort';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {SpanIdCell} from 'sentry/views/starfish/components/tableCells/spanIdCell';
import {useIndexedSpans} from 'sentry/views/starfish/queries/useIndexedSpans';
import {
  type IndexedResponse,
  SpanIndexedField,
  type SpanMetricsQueryFilters,
} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

type DataRowKeys =
  | SpanIndexedField.ID
  | SpanIndexedField.TIMESTAMP
  | SpanIndexedField.SPAN_DURATION
  | SpanIndexedField.TRANSACTION_ID
  | SpanIndexedField.TRACE
  | SpanIndexedField.PROJECT;

type ColumnKeys =
  | SpanIndexedField.ID
  | SpanIndexedField.TIMESTAMP
  | SpanIndexedField.SPAN_DURATION;

type DataRow = Pick<IndexedResponse, DataRowKeys> & {'transaction.duration': number};

type Column = GridColumnHeader<ColumnKeys>;

const COLUMN_ORDER: Column[] = [
  {
    key: SpanIndexedField.ID,
    name: t('Span ID'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: SpanIndexedField.TIMESTAMP,
    name: t('Timestamp'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: SpanIndexedField.SPAN_DURATION,
    name: t('Span Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
];

const COLUMN_TYPE: Omit<
  Record<ColumnKeys, ColumnType>,
  'spans' | 'transactionDuration'
> = {
  span_id: 'string',
  timestamp: 'date',
  'span.duration': 'duration',
};

const LIMIT = 8;

type Props = {
  project: Project | undefined;
};

export default function SpanSummaryTable(props: Props) {
  const {project} = props;
  const organization = useOrganization();
  const {spanSlug} = useParams();
  const [spanOp, groupId] = spanSlug.split(':');

  const location = useLocation();
  const {transaction} = location.query;
  const spansCursor = decodeScalar(location.query?.[QueryParameterNames.SPANS_CURSOR]);

  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
    'span.op': spanOp,
    transaction: transaction as string,
  };

  const sort = useSpanSummarySort();

  const {
    data: rowData,
    pageLinks,
    isLoading: isRowDataLoading,
  } = useIndexedSpans({
    fields: [
      SpanIndexedField.ID,
      SpanIndexedField.TRANSACTION_ID,
      SpanIndexedField.TIMESTAMP,
      SpanIndexedField.SPAN_DURATION,
      SpanIndexedField.TRACE,
    ],
    search: MutableSearch.fromQueryObject(filters),
    limit: LIMIT,
    referrer: 'api.performance.span-summary-table',
    sorts: [sort],
    cursor: spansCursor,
  });

  const transactionIds = rowData?.map(row => row[SpanIndexedField.TRANSACTION_ID]);

  const eventView = EventView.fromNewQueryWithLocation(
    {
      name: 'Transaction Durations',
      query: MutableSearch.fromQueryObject({
        project: project?.slug,
        id: `[${transactionIds?.join() ?? ''}]`,
      }).formatString(),
      fields: ['id', 'transaction.duration'],
      version: 2,
    },
    location
  );

  const {
    isLoading: isTxnDurationDataLoading,
    data: txnDurationData,
    isError: isTxnDurationError,
  } = useGenericDiscoverQuery<
    {
      data: any[];
      meta: MetaType;
    },
    DiscoverQueryProps
  >({
    route: 'events',
    eventView,
    location,
    orgSlug: organization.slug,
    getRequestPayload: () => ({
      ...eventView.getEventsAPIPayload(location),
      interval: eventView.interval,
    }),
    limit: LIMIT,
    options: {
      refetchOnWindowFocus: false,
    },
    referrer: 'api.performance.span-summary-table',
  });

  // Restructure the transaction durations into a map for faster lookup
  const transactionDurationMap = {};
  txnDurationData?.data.forEach(datum => {
    transactionDurationMap[datum.id] = datum['transaction.duration'];
  });

  const mergedData: DataRow[] =
    rowData?.map((row: Pick<IndexedResponse, DataRowKeys>) => {
      const transactionId = row[SpanIndexedField.TRANSACTION_ID];
      const newRow = {
        ...row,
        'transaction.duration': transactionDurationMap[transactionId],
      };
      return newRow;
    }) ?? [];

  const handleCursor: CursorHandler = (cursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, [QueryParameterNames.SPANS_CURSOR]: cursor},
    });
  };

  return (
    <Fragment>
      <VisuallyCompleteWithData
        id="SpanDetails-SpanDetailsTable"
        hasData={!!mergedData?.length}
        isLoading={isRowDataLoading}
      >
        <GridEditable
          isLoading={isRowDataLoading}
          data={mergedData}
          columnOrder={COLUMN_ORDER}
          columnSortBy={[
            {
              key: sort.field,
              order: sort.kind,
            },
          ]}
          grid={{
            renderHeadCell: column =>
              renderHeadCell({
                column,
                location,
                sort,
              }),
            renderBodyCell: renderBodyCell(
              location,
              organization,
              spanOp,
              isTxnDurationDataLoading || isTxnDurationError
            ),
          }}
          location={location}
        />
      </VisuallyCompleteWithData>
      <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
    </Fragment>
  );
}

function renderBodyCell(
  location: Location,
  organization: Organization,
  spanOp: string = '',
  isTxnDurationDataLoading: boolean
) {
  return function (column: Column, dataRow: DataRow): React.ReactNode {
    const {timestamp, span_id, trace, project} = dataRow;
    const spanDuration = dataRow[SpanIndexedField.SPAN_DURATION];
    const transactionId = dataRow[SpanIndexedField.TRANSACTION_ID];
    const transactionDuration = dataRow['transaction.duration'];

    if (column.key === SpanIndexedField.SPAN_DURATION) {
      if (isTxnDurationDataLoading) {
        return <SpanDurationBarLoading />;
      }

      return (
        <SpanDurationBar
          spanOp={spanOp}
          spanDuration={spanDuration}
          transactionDuration={transactionDuration}
        />
      );
    }

    if (column.key === SpanIndexedField.ID) {
      return (
        <SpanIdCell
          projectSlug={project}
          spanId={span_id}
          timestamp={timestamp}
          traceId={trace}
          transactionId={transactionId}
        />
      );
    }

    const fieldRenderer = getFieldRenderer(column.key, COLUMN_TYPE);
    const rendered = fieldRenderer(dataRow, {location, organization});

    return rendered;
  };
}

const SpanDurationBarLoading = styled('div')`
  height: ${ROW_HEIGHT - 2 * ROW_PADDING}px;
  width: 100%;
  position: relative;
  display: flex;
  top: ${space(0.5)};
  background-color: ${p => p.theme.gray100};
`;
