import {Fragment, useCallback} from 'react';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {getFlagActionLabel, type RawFlag} from 'sentry/components/featureFlags/utils';
import GridEditable, {type GridColumnOrder} from 'sentry/components/gridEditable';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {FIELD_FORMATTERS} from 'sentry/utils/discover/fieldRenderers';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

export type ColumnKey = 'provider' | 'flag' | 'action' | 'createdAt';

interface FeatureFlagsLogTableProps {
  columns: Array<GridColumnOrder<ColumnKey>>;
  error: RequestError | null;
  flags: RawFlag[];
  isPending: boolean;
  pageLinks: string | null;
  cursorKeyName?: string;
  highlightedRowKey?: number;
  onResizeColumn?: (columnIndex: number, nextColumn: GridColumnOrder<ColumnKey>) => void;
  onRowMouseOut?: (dataRow: RawFlag, key: number) => void;
  onRowMouseOver?: (dataRow: RawFlag, key: number) => void;
  scrollable?: boolean;
}

export function FeatureFlagsLogTable({
  columns,
  cursorKeyName = 'cursor',
  flags,
  isPending,
  error,
  pageLinks,
  onResizeColumn,
  onRowMouseOver,
  onRowMouseOut,
  highlightedRowKey,
  scrollable = false,
}: FeatureFlagsLogTableProps) {
  const organization = useOrganization();
  const analyticsArea = useAnalyticsArea();
  const navigate = useNavigate();

  const handlePageChange = useCallback(
    (cursor: string | undefined, path: string, searchQuery: Record<string, any>) => {
      trackAnalytics('flags.logs-paginated', {
        direction: cursor?.endsWith(':1') ? 'prev' : 'next',
        organization,
        surface: analyticsArea,
      });
      navigate({
        pathname: path,
        query: {...searchQuery, [cursorKeyName]: cursor},
      });
    },
    [analyticsArea, cursorKeyName, navigate, organization]
  );

  return (
    <Fragment>
      <GridEditable
        error={error}
        isLoading={isPending}
        data={flags ?? []}
        columnOrder={columns}
        columnSortBy={[]}
        grid={{
          renderBodyCell,
          onResizeColumn,
        }}
        onRowMouseOver={onRowMouseOver}
        onRowMouseOut={onRowMouseOut}
        highlightedRowKey={highlightedRowKey}
        scrollable={scrollable}
        data-test-id="audit-log-table"
      />

      <Pagination pageLinks={pageLinks} onCursor={handlePageChange} />
    </Fragment>
  );
}

function renderBodyCell(
  column: GridColumnOrder<ColumnKey>,
  dataRow: RawFlag,
  _rowIndex: number,
  _columnIndex: number
) {
  switch (column.key) {
    case 'flag':
      return <code>{dataRow.flag}</code>;
    case 'provider':
      return dataRow.provider || t('unknown');
    case 'createdAt':
      return FIELD_FORMATTERS.date.renderFunc('createdAt', dataRow);
    case 'action': {
      return getFlagActionLabel(dataRow.action);
    }
    default:
      return dataRow[column.key];
  }
}
