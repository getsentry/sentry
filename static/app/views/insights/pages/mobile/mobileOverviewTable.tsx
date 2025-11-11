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
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Sort} from 'sentry/utils/discover/fields';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {SPAN_HEADER_TOOLTIPS} from 'sentry/views/insights/common/components/headerTooltips/headerTooltips';
import {renderHeadCell} from 'sentry/views/insights/common/components/tableCells/renderHeadCell';
import {StarredSegmentCell} from 'sentry/views/insights/common/components/tableCells/starredSegmentCell';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import {TransactionCell} from 'sentry/views/insights/pages/transactionCell';
import type {SpanResponse} from 'sentry/views/insights/types';

type Row = Pick<
  SpanResponse,
  | 'is_starred_transaction'
  | 'transaction'
  | 'span.op'
  | 'project'
  | 'epm()'
  | 'p75(measurements.frames_slow_rate)'
  | 'p75(measurements.frames_frozen_rate)'
  | 'count_unique(user)'
  | 'sum(span.duration)'
>;

type Column = GridColumnHeader<
  | 'is_starred_transaction'
  | 'transaction'
  | 'span.op'
  | 'project'
  | 'epm()'
  | 'p75(measurements.frames_slow_rate)'
  | 'p75(measurements.frames_frozen_rate)'
  | 'count_unique(user)'
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
    tooltip: SPAN_HEADER_TOOLTIPS.tpm,
  },
  {
    key: 'p75(measurements.frames_slow_rate)',
    name: t('Slow Frame %'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'p75(measurements.frames_frozen_rate)',
    name: t('Frozen Frame %'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'count_unique(user)',
    name: t('Users'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'sum(span.duration)',
    name: DataTitles.timeSpent,
    width: COL_WIDTH_UNDEFINED,
    tooltip: SPAN_HEADER_TOOLTIPS.timeSpent,
  },
];

const SORTABLE_FIELDS = [
  'is_starred_transaction',
  'transaction',
  'span.op',
  'project',
  'epm()',
  'p75(measurements.frames_slow_rate)',
  'p75(measurements.frames_frozen_rate)',
  'count_unique(user)',
  'sum(span.duration)',
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

export function MobileOverviewTable({response, sort}: Props) {
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
        columnOrder={columns}
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
    </VisuallyCompleteWithData>
  );
}

function renderPrependColumns(isHeader: boolean, row?: Row | undefined) {
  if (isHeader) {
    return [<IconStar key="star" color="yellow300" isSolid />];
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
  if (!meta?.fields) {
    return row[column.key];
  }

  if (column.key === 'transaction') {
    // In eap, blank transaction ops are set to `default` but not in non-eap.
    // The transaction summary is not eap yet, so we should exclude the `default` transaction.op filter
    const spanOp =
      row['span.op']?.toLowerCase() === 'default' ? undefined : row['span.op'];

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
