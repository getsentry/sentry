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
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {ColumnType} from 'sentry/utils/discover/fields';

import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {SpanDurationBar} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/spanDetailsTable';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {SpanIdCell} from 'sentry/views/starfish/components/tableCells/spanIdCell';
import {
  SpanIndexedField,
  type SpanMetricsQueryFilters,
  SpanMetricsField,
  type MetricsResponse,
} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSpansTabTableSort} from 'sentry/views/performance/transactionSummary/transactionSpans/useSpansTabTableSort';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';

type DataRowKeys =
  | SpanMetricsField.SPAN_OP
  | SpanMetricsField.SPAN_DESCRIPTION
  | 'spm()'
  | `avg(${SpanMetricsField.SPAN_SELF_TIME})`
  | `sum(${SpanMetricsField.SPAN_SELF_TIME})`;

type ColumnKeys = DataRowKeys;

type DataRow = Pick<MetricsResponse, DataRowKeys>;

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
    key: `avg(${SpanMetricsField.SPAN_SELF_TIME})`,
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
  [`avg(${SpanMetricsField.SPAN_SELF_TIME})`]: 'duration',
  [`sum(${SpanMetricsField.SPAN_SELF_TIME})`]: 'duration',
};

const LIMIT = 8;

type Props = {
  project: Project | undefined;
  transactionName: string;
};

// TODO: Convert this table

export default function SpanMetricsTable(props: Props) {
  const {project, transactionName} = props;

  const location = useLocation();
  const spansCursor = decodeScalar(location.query?.[QueryParameterNames.SPANS_CURSOR]);

  const filters: SpanMetricsQueryFilters = {
    transaction: transactionName,
  };

  const handleCursor: CursorHandler = (cursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, [QueryParameterNames.SPANS_CURSOR]: cursor},
    });
  };

  const sort = useSpansTabTableSort();

  const {data, isLoading, pageLinks} = useSpanMetrics({
    search: MutableSearch.fromQueryObject(filters),
    fields: [
      SpanMetricsField.SPAN_OP,
      SpanMetricsField.SPAN_DESCRIPTION,
      `spm()`,
      `avg(${SpanMetricsField.SPAN_SELF_TIME})`,
      `sum(${SpanMetricsField.SPAN_SELF_TIME})`,
    ],
    sorts: [sort],
    cursor: spansCursor,
    limit: LIMIT,
  });

  console.dir(data);

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
            // renderBodyCell: renderBodyCell(
            //   location,
            //   organization,
            //   spanOp,
            //   isTxnDurationDataLoading || isTxnDurationError
            // ),
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
