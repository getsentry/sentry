import {useCallback, useMemo} from 'react';
import {browserHistory} from 'react-router';
import type {Location} from 'history';
import dropRightWhile from 'lodash/dropRightWhile';

import {COL_WIDTH_UNDEFINED, GridColumnOrder} from 'sentry/components/gridEditable';
import {decodeInteger, decodeList} from 'sentry/utils/queryString';

interface Props<K extends string> {
  columns: GridColumnOrder<K>[];
  location: Location;
  paramName?: string;
}

export default function useQueryBasedColumnResize<K extends string>({
  columns,
  location,
  paramName = 'width',
}: Props<K>) {
  const queryParam = location.query[paramName];
  const columnsWidthWidths = useMemo(() => {
    const widths = decodeList(queryParam);

    return columns.map((column, i) => {
      column.width = decodeInteger(widths[i], COL_WIDTH_UNDEFINED);
      return column;
    });
  }, [columns, queryParam]);

  const handleResizeColumn = useCallback(
    (columnIndex: number, resizedColumn: GridColumnOrder<K>) => {
      const widths = columns.map(
        (column, i) =>
          (i === columnIndex ? resizedColumn.width : column.width) ?? COL_WIDTH_UNDEFINED
      );
      browserHistory.replace({
        pathname: location.pathname,
        query: {
          ...location.query,
          [paramName]: dropRightWhile(widths, width => width === COL_WIDTH_UNDEFINED),
        },
      });
    },
    [columns, location.pathname, location.query, paramName]
  );

  return {
    columns: columnsWidthWidths,
    handleResizeColumn,
  };
}
