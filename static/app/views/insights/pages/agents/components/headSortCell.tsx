import {Fragment, memo} from 'react';
import styled from '@emotion/styled';
import {parseAsString, parseAsStringEnum, useQueryStates} from 'nuqs';

import SortLink from 'sentry/components/tables/gridEditable/sortLink';
import type {Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {TableUrlParams} from 'sentry/views/insights/pages/agents/utils/urlParams';

export function useTableSort(defaultValue: Sort = {field: 'count()', kind: 'desc'}) {
  const [tableSort, setTableSort] = useQueryStates(
    {
      field: parseAsString.withDefault(defaultValue.field),
      kind: parseAsStringEnum(['asc', 'desc']).withDefault(defaultValue.kind),
    },
    {
      history: 'replace',
      urlKeys: {
        field: TableUrlParams.SORT_FIELD,
        kind: TableUrlParams.SORT_ORDER,
      },
    }
  );
  return {tableSort, setTableSort};
}

export const HeadSortCell = memo(function HeadCell({
  sortKey,
  children,
  align = 'left',
  forceCellGrow = false,
  currentSort,
  onClick,
}: {
  children: React.ReactNode;
  currentSort: Sort;
  sortKey: string;
  align?: 'left' | 'right';
  forceCellGrow?: boolean;
  onClick?: (sortKey: string, newDirection: 'asc' | 'desc') => void;
}) {
  const location = useLocation();

  const reversedOrder = currentSort.kind === 'asc' ? 'desc' : 'asc';
  const newDirection = currentSort.field === sortKey ? reversedOrder : 'desc';

  return (
    <SortLink
      align={align}
      direction={currentSort.field === sortKey ? currentSort.kind : undefined}
      canSort
      preventScrollReset
      generateSortLink={() => ({
        ...location,
        query: {
          ...location.query,
          [TableUrlParams.CURSOR]: undefined,
          [TableUrlParams.SORT_FIELD]: sortKey,
          [TableUrlParams.SORT_ORDER]: newDirection,
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
