import {useCallback, useMemo, useRef} from 'react';
import dropRightWhile from 'lodash/dropRightWhile';

import {COL_WIDTH_UNDEFINED} from '@sentry/scraps/table';

import type {GridColumnOrder} from 'sentry/components/tables/dataGrid';
import {decodeInteger, decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

interface Props<Col extends GridColumnOrder<unknown>> {
  columns: Col[];
}

export function useQueryBasedColumnResize<Col extends GridColumnOrder<unknown>>({
  columns,
}: Props<Col>) {
  const location = useLocation();
  const queryParam = location.query.width;
  const navigate = useNavigate();
  const columnsWidthWidths = useMemo(() => {
    const widths = decodeList(queryParam);

    return columns.map((column, i) => ({
      ...column,
      width: decodeInteger(widths[i], column.width ?? COL_WIDTH_UNDEFINED),
    }));
  }, [columns, queryParam]);

  // One resize can commit several columns before the URL updates, so later
  // commits build on earlier ones rather than on the stale location.
  const pendingWidthsRef = useRef<{location: typeof location; widths: number[]}>(null);

  const handleResizeColumn = useCallback(
    (columnIndex: number, resizedColumn: Col) => {
      const pending = pendingWidthsRef.current;
      const baseWidths =
        pending?.location === location
          ? pending.widths
          : columnsWidthWidths.map(column => column.width ?? COL_WIDTH_UNDEFINED);
      const widths = baseWidths.with(
        columnIndex,
        resizedColumn.width ?? COL_WIDTH_UNDEFINED
      );
      pendingWidthsRef.current = {location, widths};

      navigate(
        {
          pathname: location.pathname,
          query: {
            ...location.query,
            width: dropRightWhile(widths, width => width === COL_WIDTH_UNDEFINED),
          },
        },
        {replace: true}
      );
    },
    [columnsWidthWidths, location, navigate]
  );

  return {
    columns: columnsWidthWidths,
    handleResizeColumn,
  };
}
