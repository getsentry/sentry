import {type Theme, useTheme} from '@emotion/react';
import type {Location} from 'history';

import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import type {GridColumnHeader} from 'sentry/components/tables/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
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
import {StyledIconStar} from 'sentry/views/insights/pages/backend/backendTable';
import {SPAN_OP_QUERY_PARAM} from 'sentry/views/insights/pages/frontend/settings';
import {TransactionCell} from 'sentry/views/insights/pages/transactionCell';
import type {EAPSpanResponse} from 'sentry/views/insights/types';

type Row = Pick<
  EAPSpanResponse,
  | 'is_starred_transaction'
  | 'transaction'
  | 'project'
  | 'tpm()'
  | 'p50_if(span.duration,is_transaction,true)'
  | 'p95_if(span.duration,is_transaction,true)'
  | 'failure_rate_if(is_transaction,true)'
  | 'count_unique(user)'
  | 'sum_if(span.duration,is_transaction,true)'
  | 'performance_score(measurements.score.total)'
>;

type Column = GridColumnHeader<
  | 'is_starred_transaction'
  | 'transaction'
  | 'project'
  | 'tpm()'
  | 'p50_if(span.duration,is_transaction,true)'
  | 'p95_if(span.duration,is_transaction,true)'
  | 'failure_rate_if(is_transaction,true)'
  | 'count_unique(user)'
  | 'sum_if(span.duration,is_transaction,true)'
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
  },
  {
    key: `p50_if(span.duration,is_transaction,true)`,
    name: t('p50()'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: `p95_if(span.duration,is_transaction,true)`,
    name: t('p95()'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'failure_rate_if(is_transaction,true)',
    name: t('Failure Rate'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'count_unique(user)',
    name: t('Users'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'sum_if(span.duration,is_transaction,true)',
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
  'p50_if(span.duration,is_transaction,true)',
  'p95_if(span.duration,is_transaction,true)',
  'failure_rate_if(is_transaction,true)',
  'count_unique(user)',
  'sum_if(span.duration,is_transaction,true)',
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

  let column_order = [...COLUMN_ORDER];

  if (!displayPerfScore) {
    column_order = column_order.filter(
      col => col.key !== 'performance_score(measurements.score.total)'
    );
  }

  return (
    <VisuallyCompleteWithData
      id="InsightsOverviewTable"
      hasData={data.length > 0}
      isLoading={isLoading}
    >
      <GridEditable
        aria-label={t('Domains')}
        isLoading={isLoading}
        error={response.error}
        data={data}
        columnOrder={column_order}
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
        }}
      />
      <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
    </VisuallyCompleteWithData>
  );
}

function renderPrependColumns(isHeader: boolean, row?: Row | undefined) {
  if (isHeader) {
    return [<StyledIconStar key="star" color="yellow300" isSolid />];
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
  const spanOp = decodeScalar(location.query?.[SPAN_OP_QUERY_PARAM]);
  if (!meta?.fields) {
    return row[column.key];
  }

  if (column.key === 'transaction') {
    return (
      <TransactionCell
        project={row.project}
        transaction={row.transaction}
        transactionMethod={spanOp}
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
