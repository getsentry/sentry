import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Pagination} from '@sentry/scraps/pagination';
import {Text} from '@sentry/scraps/text';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {DateTime} from 'sentry/components/dateTime';
import {getFlagActionLabel, type RawFlag} from 'sentry/components/featureFlags/utils';
import {GridEditable, type GridColumnOrder} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

export type ColumnKey = 'provider' | 'flag' | 'action' | 'createdAt';

interface FeatureFlagsLogTableProps {
  columns: Array<GridColumnOrder<ColumnKey>>;
  error: Error | null;
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
    <div>
      <GridEditable
        error={error}
        isLoading={isPending}
        data={flags ?? []}
        columnOrder={columns}
        columnSortBy={[]}
        fit="max-content"
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

      <PaginationNoMargin pageLinks={pageLinks} onCursor={handlePageChange} />
    </div>
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
      return (
        <Text tabular variant="muted" wrap="nowrap">
          {({className}) => (
            <DateTime
              className={className}
              date={dataRow.createdAt}
              seconds
              timeZone
              year
            />
          )}
        </Text>
      );
    case 'action': {
      return getFlagActionLabel(dataRow.action);
    }
    default:
      return dataRow[column.key];
  }
}

const PaginationNoMargin = styled(Pagination)`
  margin: 0;
`;
