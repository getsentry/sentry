import {Fragment} from 'react';
import type {Location} from 'history';

import type {GridColumnHeader} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types';

import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {ColumnType} from 'sentry/utils/discover/fields';
import {fieldAlignment} from 'sentry/utils/discover/fields';

import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useIndexedSpans} from 'sentry/views/starfish/queries/useIndexedSpans';
import {
  type IndexedResponse,
  SpanIndexedField,
  type SpanMetricsQueryFilters,
} from 'sentry/views/starfish/types';
import {SpanIdCell} from 'sentry/views/starfish/components/tableCells/spanIdCell';
import {SpanDurationBar} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/spanDetailsTable';
import Pagination from 'sentry/components/pagination';

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

const DEFAULT_SORT = {
  field: 'spm()' as const,
  kind: 'desc' as const,
};

const LIMIT = 8;

export default function SpanSummaryTable() {
  const organization = useOrganization();
  const {spanSlug} = useParams();
  const [spanOp, groupId] = spanSlug.split(':');

  const location = useLocation();
  const {transaction} = location.query;

  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
    'span.op': spanOp,
    transaction: transaction as string,
  };

  let sort: any = undefined; // decodeSorts(sortField).filter(isAValidSort)[0];
  if (!sort) {
    sort = DEFAULT_SORT;
  }

  const cursor = decodeScalar('spansCursor');

  const {data, pageLinks, isLoading, isError} = useIndexedSpans({
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
  });

  console.dir(data);
  console.dir(pageLinks);

  if (!data) {
    return null;
  }

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
          columnSortBy={[]}
          grid={{
            renderHeadCell,
            renderBodyCell: renderBodyCell(location, organization, spanOp),
          }}
          location={location}
        />
      </VisuallyCompleteWithData>
      <Pagination pageLinks={pageLinks ?? null} />
    </Fragment>
  );
}

function renderHeadCell(column: Column, _index: number): React.ReactNode {
  const align = fieldAlignment(column.key, COLUMN_TYPE[column.key]);
  return (
    <SortLink
      title={column.name}
      align={align}
      direction={undefined}
      canSort={false}
      generateSortLink={() => undefined}
    />
  );
}

function renderBodyCell(
  location: Location,
  organization: Organization,
  spanOp: string = ''
) {
  return function (column: Column, dataRow: DataRow): React.ReactNode {
    const {timestamp, span_id, trace, project} = dataRow;
    const spanDuration = dataRow['span.duration'];
    const transactionId = dataRow['transaction.id'];
    // if the transaction duration is falsey, then just render the span duration on its own
    // if (column.key === SpanIndexedField.SPAN_DURATION && dataRow.transactionDuration) {
    //   return (
    //     <SpanDurationBar
    //       spanOp={spanOp}
    //       spanDuration={dataRow.spanDuration}
    //       transactionDuration={dataRow.transactionDuration}
    //     />
    //   );
    // }

    if (column.key === SpanIndexedField.SPAN_DURATION) {
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
