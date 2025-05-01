import {type Theme, useTheme} from '@emotion/react';
import type {Location} from 'history';

import type {GridColumnHeader} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Sort} from 'sentry/utils/discover/fields';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {renderHeadCell} from 'sentry/views/insights/common/components/tableCells/renderHeadCell';
import {StarredSegmentCell} from 'sentry/views/insights/common/components/tableCells/starredSegmentCell';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import {StyledIconStar} from 'sentry/views/insights/pages/backend/backendTable';
import {TransactionCell} from 'sentry/views/insights/pages/transactionCell';
import type {EAPSpanResponse} from 'sentry/views/insights/types';

type Row = Pick<
  EAPSpanResponse,
  | 'is_starred_transaction'
  | 'transaction'
  | 'span.op'
  | 'project'
  | 'epm()'
  | 'p50(span.duration)'
  | 'p95(span.duration)'
  | 'failure_rate()'
  | 'time_spent_percentage(span.duration)'
  | 'sum(span.duration)'
>;

type Column = GridColumnHeader<
  | 'is_starred_transaction'
  | 'transaction'
  | 'span.op'
  | 'project'
  | 'epm()'
  | 'p50(span.duration)'
  | 'p95(span.duration)'
  | 'failure_rate()'
  | 'time_spent_percentage(span.duration)'
  | 'sum(span.duration)'
>;

const COLUMN_ORDER: Column[] = [
  {
    key: 'transaction',
    name: t('Transaction'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'span.op',
    name: t('Operation'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'project',
    name: t('Project'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'epm()',
    name: t('TPM'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: `p50(span.duration)`,
    name: t('p50()'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'p95(span.duration)',
    name: t('p95()'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'failure_rate()',
    name: t('Failure Rate'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'time_spent_percentage(span.duration)',
    name: DataTitles.timeSpent,
    width: COL_WIDTH_UNDEFINED,
  },
];

const SORTABLE_FIELDS = [
  'is_starred_transaction',
  'transaction',
  'span.op',
  'project',
  'epm()',
  'p50(span.duration)',
  'p95(span.duration)',
  'failure_rate()',
  'time_spent_percentage(span.duration)',
] as const;

export type ValidSort = Sort & {
  field: (typeof SORTABLE_FIELDS)[number];
};

export function isAValidSort(sort: Sort): sort is ValidSort {
  return (SORTABLE_FIELDS as unknown as string[]).includes(sort.field);
}

interface Props {
  response: {
    data: Row[];
    isLoading: boolean;
    error?: Error | null;
    meta?: EventsMetaType;
    pageLinks?: string;
  };
  sort: ValidSort;
}

export function FrontendOverviewTable({response, sort}: Props) {
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
        columnOrder={COLUMN_ORDER}
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
      initialIsStarred={row.is_starred_transaction}
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
  if (!meta?.fields) {
    return row[column.key];
  }

  if (column.key === 'transaction') {
    return (
      <TransactionCell
        project={row.project}
        transaction={row.transaction}
        transactionMethod={row['span.op']}
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
