import {type Theme, useTheme} from '@emotion/react';
import type {Location} from 'history';

import {Link} from 'sentry/components/core/link';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import EventView, {type EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Sort} from 'sentry/utils/discover/fields';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {renderHeadCell} from 'sentry/views/insights/common/components/tableCells/renderHeadCell';
import {useSpansIndexed} from 'sentry/views/insights/common/queries/useDiscover';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {
  type DomainView,
  useDomainViewFilters,
} from 'sentry/views/insights/pages/useFilters';
import {SpanIndexedField} from 'sentry/views/insights/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';

type Column = GridColumnHeader<
  | SpanIndexedField.SPAN_ID
  | SpanIndexedField.SPAN_DURATION
  | SpanIndexedField.TIMESTAMP
  | SpanIndexedField.USER
>;

const COLUMN_ORDER: Column[] = [
  {
    key: SpanIndexedField.SPAN_ID,
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
  SpanIndexedField.SPAN_ID,
  SpanIndexedField.SPAN_DURATION,
  SpanIndexedField.TIMESTAMP,
];

type ValidSort = Sort & {
  field:
    | SpanIndexedField.SPAN_ID
    | SpanIndexedField.SPAN_DURATION
    | SpanIndexedField.TIMESTAMP;
};

function isAValidSort(sort: Sort): sort is ValidSort {
  return (SORTABLE_FIELDS as unknown as string[]).includes(sort.field);
}

interface Props {
  groupId: string;
  referrer?: string;
}
export function PipelineSpansTable({groupId}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const theme = useTheme();
  const {view} = useDomainViewFilters();

  const sortField = decodeScalar(location.query?.[QueryParameterNames.SPANS_SORT]);

  let sort = decodeSorts(sortField).find(isAValidSort);
  if (!sort) {
    sort = {field: SpanIndexedField.TIMESTAMP, kind: 'desc'};
  }

  const {
    data: rawData,
    meta: rawMeta,
    error,
    isPending,
  } = useSpansIndexed(
    {
      limit: 30,
      sorts: [sort],
      fields: [
        SpanIndexedField.SPAN_ID,
        SpanIndexedField.TRACE,
        SpanIndexedField.SPAN_DURATION,
        SpanIndexedField.TRANSACTION_SPAN_ID,
        SpanIndexedField.USER,
        SpanIndexedField.TIMESTAMP,
        SpanIndexedField.PROJECT,
      ],
      search: new MutableSearch(`span.category:ai.pipeline span.group:"${groupId}"`),
    },
    'api.ai-pipelines.view'
  );

  const data = rawData ?? [];
  const meta = rawMeta;

  return (
    <VisuallyCompleteWithData
      id="PipelineSpansTable"
      hasData={data.length > 0}
      isLoading={isPending}
    >
      <GridEditable
        isLoading={isPending}
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
            renderBodyCell(
              column,
              row,
              meta,
              location,
              organization,
              groupId,
              view,
              theme
            ),
        }}
      />
    </VisuallyCompleteWithData>
  );
}

function renderBodyCell(
  column: Column,
  row: any,
  meta: EventsMetaType | undefined,
  location: Location,
  organization: Organization,
  groupId: string,
  view: DomainView | undefined,
  theme: Theme
) {
  if (column.key === SpanIndexedField.SPAN_ID) {
    if (!row[SpanIndexedField.SPAN_ID]) {
      return <span>(unknown)</span>;
    }
    if (!row[SpanIndexedField.TRACE]) {
      return <span>{row[SpanIndexedField.SPAN_ID]}</span>;
    }
    return (
      <Link
        to={generateLinkToEventInTraceView({
          organization,
          targetId: row[SpanIndexedField.TRANSACTION_SPAN_ID],
          traceSlug: row[SpanIndexedField.TRACE],
          timestamp: row[SpanIndexedField.TIMESTAMP],
          location: {
            ...location,
            query: {
              ...location.query,
              groupId,
            },
          },
          eventView: EventView.fromLocation(location),
          spanId: row[SpanIndexedField.SPAN_ID],
          source: TraceViewSources.LLM_MODULE,
          view,
        })}
      >
        {row[SpanIndexedField.SPAN_ID]}
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
    theme,
  });

  return rendered;
}
