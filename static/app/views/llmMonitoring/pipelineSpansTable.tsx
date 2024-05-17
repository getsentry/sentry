import type {Location} from 'history';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import EventView, {type EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Sort} from 'sentry/utils/discover/fields';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {useIndexedSpans} from 'sentry/views/starfish/queries/useIndexedSpans';
import {SpanIndexedField} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

type Column = GridColumnHeader<
  | SpanIndexedField.ID
  | SpanIndexedField.SPAN_DURATION
  | SpanIndexedField.TIMESTAMP
  | SpanIndexedField.USER
>;

const COLUMN_ORDER: Column[] = [
  {
    key: SpanIndexedField.ID,
    name: t('Span ID'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: SpanIndexedField.USER,
    name: t('User'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: SpanIndexedField.TIMESTAMP,
    name: t('Timestamp'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: SpanIndexedField.SPAN_DURATION,
    name: t('Total duration'),
    width: 150,
  },
];

const SORTABLE_FIELDS = [
  SpanIndexedField.ID,
  SpanIndexedField.SPAN_DURATION,
  SpanIndexedField.TIMESTAMP,
];

type ValidSort = Sort & {
  field:
    | SpanIndexedField.ID
    | SpanIndexedField.SPAN_DURATION
    | SpanIndexedField.TIMESTAMP;
};

export function isAValidSort(sort: Sort): sort is ValidSort {
  return (SORTABLE_FIELDS as unknown as string[]).includes(sort.field);
}

interface Props {
  groupId: string;
}
export function PipelineSpansTable({groupId}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  const sortField = decodeScalar(location.query?.[QueryParameterNames.SPANS_SORT]);

  let sort = decodeSorts(sortField).filter(isAValidSort)[0];
  if (!sort) {
    sort = {field: SpanIndexedField.TIMESTAMP, kind: 'desc'};
  }

  const {
    data: rawData,
    meta: rawMeta,
    error,
    isLoading,
  } = useIndexedSpans({
    limit: 30,
    sorts: [sort],
    fields: [
      SpanIndexedField.ID,
      SpanIndexedField.TRACE,
      SpanIndexedField.SPAN_DURATION,
      SpanIndexedField.TRANSACTION_ID,
      SpanIndexedField.USER,
      SpanIndexedField.TIMESTAMP,
      SpanIndexedField.PROJECT,
    ],
    referrer: 'api.ai-pipelines.view',
    search: new MutableSearch(`span.category:ai.pipeline span.group:"${groupId}"`),
  });
  const data = rawData || [];
  const meta = rawMeta as EventsMetaType;

  return (
    <VisuallyCompleteWithData
      id="PipelineSpansTable"
      hasData={data.length > 0}
      isLoading={isLoading}
    >
      <GridEditable
        isLoading={isLoading}
        error={error}
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
              sort,
              location,
              sortParameterName: QueryParameterNames.SPANS_SORT,
            }),
          renderBodyCell: (column, row) =>
            renderBodyCell(column, row, meta, location, organization),
        }}
        location={location}
      />
    </VisuallyCompleteWithData>
  );
}

function renderBodyCell(
  column: Column,
  row: any,
  meta: EventsMetaType | undefined,
  location: Location,
  organization: Organization
) {
  if (column.key === SpanIndexedField.ID) {
    if (!row[SpanIndexedField.ID]) {
      return <span>(unknown)</span>;
    }
    if (!row[SpanIndexedField.TRACE]) {
      return <span>{row[SpanIndexedField.ID]}</span>;
    }
    return (
      <Link
        to={generateLinkToEventInTraceView({
          organization,
          eventId: row[SpanIndexedField.TRANSACTION_ID],
          projectSlug: row[SpanIndexedField.PROJECT],
          traceSlug: row[SpanIndexedField.TRACE],
          timestamp: row[SpanIndexedField.TIMESTAMP],
          location,
          eventView: EventView.fromLocation(location),
          spanId: row[SpanIndexedField.ID],
        })}
      >
        {row[SpanIndexedField.ID]}
      </Link>
    );
  }

  if (!meta || !meta?.fields) {
    return row[column.key];
  }

  const renderer = getFieldRenderer(column.key, meta.fields, false);

  const rendered = renderer(row, {
    location,
    organization,
    unit: meta.units?.[column.key],
  });

  return rendered;
}
