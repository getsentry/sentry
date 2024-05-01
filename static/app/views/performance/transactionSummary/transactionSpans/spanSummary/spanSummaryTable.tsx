import {Fragment} from 'react';
import type {Location} from 'history';

import type {GridColumnHeader} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import Pagination, {type CursorHandler} from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import type {Organization, Project} from 'sentry/types';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {ColumnType} from 'sentry/utils/discover/fields';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {SpanDurationBar} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/spanDetailsTable';
import {SpanIdCell} from 'sentry/views/starfish/components/tableCells/spanIdCell';
import {useIndexedSpans} from 'sentry/views/starfish/queries/useIndexedSpans';
import {
  type IndexedResponse,
  SpanIndexedField,
  type SpanMetricsQueryFilters,
} from 'sentry/views/starfish/types';
import {useSpanSummarySort} from 'sentry/views/performance/transactionSummary/transactionSpans/spanSummary/useSpanSummarySort';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {browserHistory} from 'react-router';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {decodeScalar} from 'sentry/utils/queryString';
import EventView, {MetaType} from 'sentry/utils/discover/eventView';
import {
  useGenericDiscoverQuery,
  DiscoverQueryProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import styled from '@emotion/styled';
import {space} from 'sentry/styles/space';
import {ROW_HEIGHT, ROW_PADDING} from 'sentry/components/performance/waterfall/constants';

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

type DataRow = Pick<IndexedResponse, DataRowKeys>;

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
  const cursor = decodeScalar(location.query?.[QueryParameterNames.SPANS_CURSOR]);

  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
    'span.op': spanOp,
    transaction: transaction as string,
  };

  const sort = useSpanSummarySort();

  const {data, pageLinks, isLoading} = useIndexedSpans({
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
    cursor,
  });

  if (!data) {
    return null;
  }

  const transactionIds = data.map(row => row[SpanIndexedField.TRANSACTION_ID]);

  const eventView = EventView.fromNewQueryWithLocation(
    {
      name: 'Transaction Durations',
      query: MutableSearch.fromQueryObject({
        project: project?.slug,
        id: `[${transactionIds.join()}]`,
      }).formatString(),
      fields: ['id', 'trace', 'transaction.duration'],
      version: 2,
    },
    location
  );

  console.dir(eventView);

  const {
    isLoading: isTxnDurationDataLoading,
    data: txnDurationData,
    isError: txnDurationError,
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
      // topEvents: eventView.topEvents,
      //excludeOther: 0,
      //partial: 1,
      //orderby: undefined,
      interval: eventView.interval,
    }),
    limit: LIMIT,
    options: {
      refetchOnWindowFocus: false,
    },
    referrer: 'api.performance.span-summary-table',
  });

  console.dir(txnDurationData);

  // const transactionIds = data.

  // if (!defined(examples)) {
  //   return null;
  // }

  // const data = examples
  //   // we assume that the span appears in each example at least once,
  //   // if this assumption is broken, nothing onwards will work so
  //   // filter out such examples
  //   .filter(example => example.spans.length > 0)
  //   .map(example => ({
  //     id: example.id,
  //     project: project?.slug,
  //     // timestamps are in seconds but want them in milliseconds
  //     timestamp: example.finishTimestamp * 1000,
  //     transactionDuration: (example.finishTimestamp - example.startTimestamp) * 1000,
  //     spanDuration: example.nonOverlappingExclusiveTime,
  //     occurrences: example.spans.length,
  //     cumulativeDuration: example.spans.reduce(
  //       (duration, span) => duration + span.exclusiveTime,
  //       0
  //     ),
  //     spans: example.spans,
  //   }));

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
        hasData={!!data?.length}
        isLoading={isLoading}
      >
        <GridEditable
          isLoading={isLoading}
          data={data}
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
              isTxnDurationDataLoading || txnDurationError
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
    const spanDuration = dataRow['span.duration'];
    const transactionId = dataRow['transaction.id'];

    if (column.key === SpanIndexedField.SPAN_DURATION) {
      if (isTxnDurationDataLoading) {
        return <SpanDurationBarLoading />;
      }

      return (
        <SpanDurationBar
          spanOp={spanOp}
          spanDuration={dataRow[SpanIndexedField.SPAN_DURATION]}
          transactionDuration={100}
        />
      );
    }

    const fieldRenderer = getFieldRenderer(column.key, COLUMN_TYPE);
    let rendered = fieldRenderer(dataRow, {location, organization});

    if (column.key === SpanIndexedField.ID) {
      // const traceSlug = dataRow.spans[0] ? dataRow.spans[0].trace : '';
      // const worstSpan = dataRow.spans.length
      //   ? dataRow.spans.reduce((worst, span) =>
      //       worst.exclusiveTime >= span.exclusiveTime ? worst : span
      //     )
      //   : null;

      // const target = generateLinkToEventInTraceView({
      //   eventSlug: generateEventSlug(dataRow),
      //   dataRow: {...dataRow, trace: traceSlug, timestamp: dataRow.timestamp / 1000},
      //   eventView: EventView.fromLocation(location),
      //   location,
      //   organization,
      //   spanId: worstSpan.id,
      //   transactionName: transactionName,
      // });

      rendered = (
        <SpanIdCell
          projectSlug={project}
          spanId={span_id}
          timestamp={timestamp}
          traceId={trace}
          transactionId={transactionId}
        />
      );
    }

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
