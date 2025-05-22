import {Fragment, memo} from 'react';

import type {GridColumnHeader} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import type {QueryValue} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';

function decodeSortField(value: QueryValue): string {
  if (typeof value === 'string') {
    return value;
  }
  return 'count()';
}

function isSortOrder(value: string): value is 'asc' | 'desc' {
  return value === 'asc' || value === 'desc';
}

function decodeSortOrder(value: QueryValue): 'asc' | 'desc' {
  if (typeof value === 'string' && isSortOrder(value)) {
    return value;
  }
  return 'desc';
}

function useTableSortParams() {
  const {field: sortField, order: sortOrder} = useLocationQuery({
    fields: {
      field: decodeSortField,
      order: decodeSortOrder,
    },
  });
  return {sortField, sortOrder};
}

export const HeadSortCell = memo(function HeadCell({
  column,
  children,
}: {
  children: React.ReactNode;
  column: GridColumnHeader<string>;
}) {
  const location = useLocation();
  const {sortField, sortOrder} = useTableSortParams();
  return (
    <SortLink
      align={'left'}
      direction={sortField === column.key ? sortOrder : undefined}
      canSort
      preventScrollReset
      generateSortLink={() => ({
        ...location,
        query: {
          ...location.query,
          field: column.key,
          order:
            sortField === column.key ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'desc',
        },
      })}
      title={<Fragment>{children}</Fragment>}
    />
  );
});
