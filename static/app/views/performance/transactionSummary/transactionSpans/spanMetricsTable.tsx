import {Fragment} from 'react';
import {browserHistory, Link} from 'react-router';
import type {Location} from 'history';

import type {GridColumnHeader} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import Pagination, {type CursorHandler} from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import type {Organization, Project} from 'sentry/types';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {ColumnType} from 'sentry/utils/discover/fields';
import {Container as TableCellContainer} from 'sentry/utils/discover/styles';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {spanDetailsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';
import {useSpansTabTableSort} from 'sentry/views/performance/transactionSummary/transactionSpans/useSpansTabTableSort';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useDiscover';
import {
  SpanMetricsField,
  type SpanMetricsQueryFilters,
} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

type DataRow = {
  [SpanMetricsField.SPAN_OP]: string;
  [SpanMetricsField.SPAN_DESCRIPTION]: string;
  [SpanMetricsField.SPAN_GROUP]: string;
  'avg(span.duration)': number;
  'spm()': number;
  'sum(span.self_time)': number;
};

type ColumnKeys =
  | SpanMetricsField.SPAN_OP
  | SpanMetricsField.SPAN_DESCRIPTION
  | 'spm()'
  | `avg(${SpanMetricsField.SPAN_DURATION})`
  | `sum(${SpanMetricsField.SPAN_SELF_TIME})`;

type Column = GridColumnHeader<ColumnKeys>;

const COLUMN_ORDER: Column[] = [
  {
    key: SpanMetricsField.SPAN_OP,
    name: t('Span Operation'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: SpanMetricsField.SPAN_DESCRIPTION,
    name: t('Span Name'),
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
    key: `sum(${SpanMetricsField.SPAN_SELF_TIME})`,
    name: t('Time Spent'),
    width: COL_WIDTH_UNDEFINED,
  },
];

const COLUMN_TYPE: Record<ColumnKeys, ColumnType> = {
  [SpanMetricsField.SPAN_OP]: 'string',
  [SpanMetricsField.SPAN_DESCRIPTION]: 'string',
  ['spm()']: 'rate',
  [`avg(${SpanMetricsField.SPAN_DURATION})`]: 'duration',
  [`sum(${SpanMetricsField.SPAN_SELF_TIME})`]: 'duration',
};

const LIMIT = 12;

type Props = {
  project: Project | undefined;
  transactionName: string;
};

export default function SpanMetricsTable(props: Props) {
  const {project, transactionName} = props;
  const organization = useOrganization();

  const location = useLocation();
  const spansCursor = decodeScalar(location.query?.[QueryParameterNames.SPANS_CURSOR]);
  const spanOp = decodeScalar(location.query?.spanOp);

  const filters: SpanMetricsQueryFilters = {
    transaction: transactionName,
    ['span.op']: spanOp,
  };

  const handleCursor: CursorHandler = (cursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, [QueryParameterNames.SPANS_CURSOR]: cursor},
    });
  };

  const sort = useSpansTabTableSort();

  const {data, isLoading, pageLinks} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject(filters),
      fields: [
        SpanMetricsField.SPAN_OP,
        SpanMetricsField.SPAN_DESCRIPTION,
        SpanMetricsField.SPAN_GROUP,
        `spm()`,
        `avg(${SpanMetricsField.SPAN_DURATION})`,
        `sum(${SpanMetricsField.SPAN_SELF_TIME})`,
      ],
      sorts: [sort],
      cursor: spansCursor,
      limit: LIMIT,
    },
    ''
  );

  return (
    <Fragment>
      <VisuallyCompleteWithData
        id="TransactionSpans-SpanMetricsTable"
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
              transactionName,
              project
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
  transactionName: string,
  project?: Project
) {
  return function (column: Column, dataRow: DataRow): React.ReactNode {
    if (column.key === SpanMetricsField.SPAN_DESCRIPTION) {
      const target = spanDetailsRouteWithQuery({
        orgSlug: organization.slug,
        transaction: transactionName,
        query: location.query,
        spanSlug: {op: dataRow['span.op'], group: dataRow['span.group']},
        projectID: project?.id,
      });

      return (
        <TableCellContainer>
          <Link to={target}>{dataRow[column.key] || t('(unnamed span)')}</Link>
        </TableCellContainer>
      );
    }

    const fieldRenderer = getFieldRenderer(column.key, COLUMN_TYPE, false);
    const rendered = fieldRenderer(dataRow, {location, organization});

    return rendered;
  };
}
