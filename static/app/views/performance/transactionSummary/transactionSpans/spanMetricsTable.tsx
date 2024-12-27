import {Fragment} from 'react';
import type {Location} from 'history';

import type {GridColumnHeader} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import Pagination, {type CursorHandler} from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {ColumnType} from 'sentry/utils/discover/fields';
import {Container as TableCellContainer} from 'sentry/utils/discover/styles';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {renderHeadCell} from 'sentry/views/insights/common/components/tableCells/renderHeadCell';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {
  type DomainView,
  useDomainViewFilters,
} from 'sentry/views/insights/pages/useFilters';
import {
  SpanMetricsField,
  type SpanMetricsQueryFilters,
} from 'sentry/views/insights/types';
import {spanDetailsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';
import {useSpansTabTableSort} from 'sentry/views/performance/transactionSummary/transactionSpans/useSpansTabTableSort';

type DataRow = {
  [SpanMetricsField.SPAN_OP]: string;
  [SpanMetricsField.SPAN_DESCRIPTION]: string;
  [SpanMetricsField.SPAN_GROUP]: string;
  'avg(span.duration)': number;
  'spm()': number;
  'sum(span.duration)': number;
};

type ColumnKeys =
  | SpanMetricsField.SPAN_OP
  | SpanMetricsField.SPAN_DESCRIPTION
  | 'spm()'
  | `avg(${SpanMetricsField.SPAN_DURATION})`
  | `sum(${SpanMetricsField.SPAN_DURATION})`;

type Column = GridColumnHeader<ColumnKeys>;

const COLUMN_ORDER: Column[] = [
  {
    key: SpanMetricsField.SPAN_OP,
    name: t('Span Operation'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: SpanMetricsField.SPAN_DESCRIPTION,
    name: t('Span Description'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'spm()',
    name: t('Throughput'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: `avg(${SpanMetricsField.SPAN_DURATION})`,
    name: t('Avg Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: `sum(${SpanMetricsField.SPAN_DURATION})`,
    name: t('Time Spent'),
    width: COL_WIDTH_UNDEFINED,
  },
];

const COLUMN_TYPE: Record<ColumnKeys, ColumnType> = {
  [SpanMetricsField.SPAN_OP]: 'string',
  [SpanMetricsField.SPAN_DESCRIPTION]: 'string',
  ['spm()']: 'rate',
  [`avg(${SpanMetricsField.SPAN_DURATION})`]: 'duration',
  [`sum(${SpanMetricsField.SPAN_DURATION})`]: 'duration',
};

const LIMIT = 12;

type Props = {
  project: Project | undefined;
  query: string;
  transactionName: string;
};

export default function SpanMetricsTable(props: Props) {
  const {project, transactionName, query: search} = props;
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const sort = useSpansTabTableSort();
  const domainViewFilters = useDomainViewFilters();

  const query = useLocationQuery({
    fields: {
      spansCursor: decodeScalar,
      spanOp: decodeScalar,
    },
  });

  const {spansCursor, spanOp} = query;

  const filters: SpanMetricsQueryFilters = {
    transaction: transactionName,
    ['span.op']: spanOp,
  };

  const handleCursor: CursorHandler = (cursor, pathname, q) => {
    navigate({
      pathname,
      query: {...q, [QueryParameterNames.SPANS_CURSOR]: cursor},
    });
  };

  const mutableSearch = MutableSearch.fromQueryObject(filters);
  mutableSearch.addStringMultiFilter(search);

  const {data, isPending, pageLinks} = useSpanMetrics(
    {
      search: mutableSearch,
      fields: [
        SpanMetricsField.SPAN_OP,
        SpanMetricsField.SPAN_DESCRIPTION,
        SpanMetricsField.SPAN_GROUP,
        `spm()`,
        `avg(${SpanMetricsField.SPAN_DURATION})`,
        `sum(${SpanMetricsField.SPAN_DURATION})`,
      ],
      sorts: [sort],
      cursor: spansCursor,
      limit: LIMIT,
    },
    'api.performance.transaction-spans'
  );

  return (
    <Fragment>
      <VisuallyCompleteWithData
        id="TransactionSpans-SpanMetricsTable"
        hasData={!!data?.length}
        isLoading={isPending}
      >
        <GridEditable
          isLoading={isPending}
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
              transactionName,
              project,
              domainViewFilters?.view
            ),
          }}
        />
      </VisuallyCompleteWithData>
      <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
    </Fragment>
  );
}

function renderBodyCell(
  location: Location,
  organization: Organization,
  transactionName: string,
  project?: Project,
  view?: DomainView
) {
  return function (column: Column, dataRow: DataRow): React.ReactNode {
    if (column.key === SpanMetricsField.SPAN_OP) {
      const target = spanDetailsRouteWithQuery({
        orgSlug: organization.slug,
        transaction: transactionName,
        query: location.query,
        spanSlug: {op: dataRow['span.op'], group: ''},
        projectID: project?.id,
        view,
      });

      return (
        <TableCellContainer>
          <Link to={target}>{dataRow[column.key]}</Link>
        </TableCellContainer>
      );
    }

    if (column.key === SpanMetricsField.SPAN_DESCRIPTION) {
      if (!dataRow['span.group']) {
        return <TableCellContainer>{'\u2014'}</TableCellContainer>;
      }

      const target = spanDetailsRouteWithQuery({
        orgSlug: organization.slug,
        transaction: transactionName,
        query: location.query,
        spanSlug: {op: dataRow['span.op'], group: dataRow['span.group']},
        projectID: project?.id,
        view,
      });

      return (
        <TableCellContainer>
          <Link to={target}>{dataRow[column.key]}</Link>
        </TableCellContainer>
      );
    }

    const fieldRenderer = getFieldRenderer(column.key, COLUMN_TYPE, false);
    const rendered = fieldRenderer(dataRow, {location, organization});

    return rendered;
  };
}
