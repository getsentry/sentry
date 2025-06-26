import {Fragment, memo} from 'react';
import styled from '@emotion/styled';

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

export function useTableSortParams() {
  const {field: sortField, order: sortOrder} = useLocationQuery({
    fields: {
      field: decodeSortField,
      order: decodeSortOrder,
    },
  });
  return {sortField, sortOrder};
}

export const HeadSortCell = memo(function HeadCell({
  sortKey,
  children,
  align = 'left',
  forceCellGrow = false,
  cursorParamName = 'cursor',
  onClick,
}: {
  children: React.ReactNode;
  sortKey: string;
  align?: 'left' | 'right';
  cursorParamName?: string;
  forceCellGrow?: boolean;
  onClick?: (sortKey: string, newDirection: 'asc' | 'desc') => void;
}) {
  const location = useLocation();
  const {sortField, sortOrder} = useTableSortParams();
  const newDirection =
    sortField === sortKey ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'desc';

  return (
    <SortLink
      align={align}
      direction={sortField === sortKey ? sortOrder : undefined}
      canSort
      preventScrollReset
      generateSortLink={() => ({
        ...location,
        query: {
          ...location.query,
          [cursorParamName]: undefined,
          field: sortKey,
          order: newDirection,
        },
      })}
      onClick={() => onClick?.(sortKey, newDirection)}
      title={
        <Fragment>
          {forceCellGrow && <CellExpander />}
          {children}
        </Fragment>
      }
    />
  );
});

/**
 * Used to force the cell to expand take as much width as possible in the table layout
 * otherwise grid editable will let the last column grow
 */
const CellExpander = styled('div')`
  width: 100vw;
`;
