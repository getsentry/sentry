import {useTheme, type Theme} from '@emotion/react';
import type {Location} from 'history';

import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import type {GridColumnHeader} from 'sentry/components/tables/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import useQueryBasedColumnResize from 'sentry/components/tables/gridEditable/useQueryBasedColumnResize';
import {IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {DemoTourElement, DemoTourStep} from 'sentry/utils/demoMode/demoTours';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Sort} from 'sentry/utils/discover/fields';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {SPAN_HEADER_TOOLTIPS} from 'sentry/views/insights/common/components/headerTooltips/headerTooltips';
import {renderHeadCell} from 'sentry/views/insights/common/components/tableCells/renderHeadCell';
import {StarredSegmentCell} from 'sentry/views/insights/common/components/tableCells/starredSegmentCell';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import {SPAN_OP_QUERY_PARAM} from 'sentry/views/insights/pages/frontend/settings';
import {getSpanOpFromQuery} from 'sentry/views/insights/pages/frontend/utils/pageSpanOp';
import {TransactionCell} from 'sentry/views/insights/pages/transactionCell';
import type {SpanResponse} from 'sentry/views/insights/types';

export type Row = Pick<
  SpanResponse,
  | 'is_starred_transaction'
  | 'transaction'
  | 'project'
  | 'tpm()'
  | 'p50_if(span.duration,is_transaction,equals,true)'
  | 'p75_if(span.duration,is_transaction,equals,true)'
  | 'p95_if(span.duration,is_transaction,equals,true)'
  | 'failure_rate_if(is_transaction,equals,true)'
  | 'count_unique(user)'
  | 'sum_if(span.duration,is_transaction,equals,true)'
  | 'performance_score(measurements.score.total)'
>;

type Column = GridColumnHeader<
  | 'is_starred_transaction'
  | 'transaction'
  | 'project'
  | 'tpm()'
  | 'p50_if(span.duration,is_transaction,equals,true)'
  | 'p75_if(span.duration,is_transaction,equals,true)'
  | 'p95_if(span.duration,is_transaction,equals,true)'
  | 'failure_rate_if(is_transaction,equals,true)'
  | 'count_unique(user)'
  | 'sum_if(span.duration,is_transaction,equals,true)'
  | 'performance_score(measurements.score.total)'
>;

const COLUMN_ORDER: Column[] = [
  {
    key: 'transaction',
    name: t('Transaction'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'project',
    name: t('Project'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'tpm()',
    name: t('TPM'),
    width: COL_WIDTH_UNDEFINED,
    tooltip: SPAN_HEADER_TOOLTIPS.tpm,
  },
  {
    key: `p50_if(span.duration,is_transaction,equals,true)`,
    name: t('p50()'),
    width: COL_WIDTH_UNDEFINED,
    tooltip: SPAN_HEADER_TOOLTIPS.p50,
  },
  {
    key: `p75_if(span.duration,is_transaction,equals,true)`,
    name: t('p75()'),
    width: COL_WIDTH_UNDEFINED,
    tooltip: SPAN_HEADER_TOOLTIPS.p75,
  },
  {
    key: `p95_if(span.duration,is_transaction,equals,true)`,
    name: t('p95()'),
    width: COL_WIDTH_UNDEFINED,
    tooltip: SPAN_HEADER_TOOLTIPS.p95,
  },
  {
    key: 'failure_rate_if(is_transaction,equals,true)',
    name: t('Failure Rate'),
    width: COL_WIDTH_UNDEFINED,
    tooltip: SPAN_HEADER_TOOLTIPS.failureRate,
  },
  {
    key: 'count_unique(user)',
    name: t('Users'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'sum_if(span.duration,is_transaction,equals,true)',
    name: DataTitles.timeSpent,
    width: COL_WIDTH_UNDEFINED,
    tooltip: SPAN_HEADER_TOOLTIPS.timeSpent,
  },
  {
    key: 'performance_score(measurements.score.total)',
    name: DataTitles.performanceScore,
    width: COL_WIDTH_UNDEFINED,
    tooltip: SPAN_HEADER_TOOLTIPS.performanceScore,
  },
];

const SORTABLE_FIELDS = [
  'is_starred_transaction',
  'transaction',
  'project',
  'tpm()',
  'p50_if(span.duration,is_transaction,equals,true)',
  'p75_if(span.duration,is_transaction,equals,true)',
  'p95_if(span.duration,is_transaction,equals,true)',
  'failure_rate_if(is_transaction,equals,true)',
  'count_unique(user)',
  'sum_if(span.duration,is_transaction,equals,true)',
  'performance_score(measurements.score.total)',
] as const;

export type ValidSort = Sort & {
  field: (typeof SORTABLE_FIELDS)[number];
};

export function isAValidSort(sort: Sort): sort is ValidSort {
  return (SORTABLE_FIELDS as unknown as string[]).includes(sort.field);
}

interface Props {
  displayPerfScore: boolean;
  response: {
    data: Row[];
    isLoading: boolean;
    error?: Error | null;
    meta?: EventsMetaType;
    pageLinks?: string;
  };
  sort: ValidSort;
}

export function FrontendOverviewTable({displayPerfScore, response, sort}: Props) {
  const {data, isLoading, meta, pageLinks} = response;
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const theme = useTheme();
  const handleCursor: CursorHandler = (newCursor, pathname, query) => {
    navigate({
      pathname,
      query: {...query, [QueryParameterNames.PAGES_CURSOR]: newCursor},
    });
  };
  const {columns, handleResizeColumn} = useQueryBasedColumnResize({
    columns: [...COLUMN_ORDER],
  });

  let filteredColumns = [...columns];
  if (!displayPerfScore) {
    filteredColumns = filteredColumns.filter(
      col => col.key !== 'performance_score(measurements.score.total)'
    );
  }

  return (
    <VisuallyCompleteWithData
      id="InsightsOverviewTable"
      hasData={data.length > 0}
      isLoading={isLoading}
    >
      <DemoTourElement
        id={DemoTourStep.PERFORMANCE_TABLE}
        title={t('See slow transactions')}
        description={t(
          `Trace slow-loading pages back to their API calls, as well as, related errors and users impacted across projects.
      Select a transaction to see more details.`
        )}
      >
        <GridEditable
          aria-label={t('Domains')}
          isLoading={isLoading}
          error={response.error}
          data={data}
          columnOrder={filteredColumns}
          columnSortBy={[
            {
              key: sort.field,
              order: sort.kind,
            },
          ]}
          grid={{
            prependColumnWidths: ['max-content'],
            renderPrependColumns,
            renderHeadCell: column =>
              renderHeadCell({
                column,
                sort,
                location,
              }),
            renderBodyCell: (column, row) =>
              renderBodyCell(column, row, meta, location, organization, theme),
            onResizeColumn: handleResizeColumn,
          }}
        />
        <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
      </DemoTourElement>
    </VisuallyCompleteWithData>
  );
}

function renderPrependColumns(isHeader: boolean, row?: Row | undefined) {
  if (isHeader) {
    return [<IconStar key="star" variant="warning" isSolid />];
  }

  if (!row) {
    return [];
  }
  return [
    <StarredSegmentCell
      key={row.transaction}
      isStarred={row.is_starred_transaction}
      projectSlug={row.project}
      segmentName={row.transaction}
    />,
  ];
}

function renderBodyCell(
  column: Column,
  row: Row,
  meta: EventsMetaType | undefined,
  location: Location,
  organization: Organization,
  theme: Theme
) {
  const spanOp = getSpanOpFromQuery(decodeScalar(location.query?.[SPAN_OP_QUERY_PARAM]));

  if (!meta?.fields) {
    return row[column.key];
  }

  if (column.key === 'transaction') {
    return (
      <TransactionCell
        project={row.project}
        transaction={row.transaction}
        transactionMethod={spanOp === 'all' ? undefined : spanOp}
      />
    );
  }

  const renderer = getFieldRenderer(column.key, meta.fields, false);

  return renderer(row, {
    location,
    organization,
    unit: meta.units?.[column.key],
    theme,
  });
}
