import {useCallback, useMemo} from 'react';
import dropRightWhile from 'lodash/dropRightWhile';

import type {GridColumnOrder} from 'sentry/components/tables/gridEditable';
import {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import {decodeInteger, decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

interface Props<Col extends GridColumnOrder<unknown>> {
  columns: Col[];
  paramName?: string;
}

export default function useQueryBasedColumnResize<Col extends GridColumnOrder<unknown>>({
  columns,
  paramName = 'width',
}: Props<Col>) {
  const location = useLocation();
  const queryParam = location.query[paramName];
  const navigate = useNavigate();
  const columnsWidthWidths = useMemo(() => {
    const widths = decodeList(queryParam);

    return columns.map((column, i) => {
      column.width = decodeInteger(widths[i], COL_WIDTH_UNDEFINED);
      return column;
    });
  }, [columns, queryParam]);

  const handleResizeColumn = useCallback(
    (columnIndex: number, resizedColumn: Col) => {
      const widths = columns.map(
        (column, i) =>
          (i === columnIndex ? resizedColumn.width : column.width) ?? COL_WIDTH_UNDEFINED
      );
      navigate(
        {
          pathname: location.pathname,
          query: {
            ...location.query,
            [paramName]: dropRightWhile(widths, width => width === COL_WIDTH_UNDEFINED),
          },
        },
        {replace: true}
      );
    },
    [columns, location.pathname, location.query, paramName, navigate]
  );

  return {
    columns: columnsWidthWidths,
    handleResizeColumn,
  };
}
