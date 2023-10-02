import {useCallback, useMemo} from 'react';
import {browserHistory} from 'react-router';
import type {Location} from 'history';
import dropRightWhile from 'lodash/dropRightWhile';

import {COL_WIDTH_UNDEFINED, GridColumnOrder} from 'sentry/components/gridEditable';
import {decodeInteger, decodeList} from 'sentry/utils/queryString';

interface Props {
  columns: GridColumnOrder<string>[];
  location: Location<{widths: string[]}>;
}

export default function useQueryBasedColumnResize({columns, location}: Props) {
  const columnsWidthWidths = useMemo(() => {
    const widths = decodeList(location.query.widths);

    return columns.map((column, i) => {
      column.width = decodeInteger(widths[i], COL_WIDTH_UNDEFINED);
      return column;
    });
  }, [columns, location.query.widths]);

  const handleResizeColumn = useCallback(
    (columnIndex, resizedColumn) => {
      const widths = columns.map(
        (column, i) =>
          (i === columnIndex ? resizedColumn.width : column.width) ?? COL_WIDTH_UNDEFINED
      );
      browserHistory.push({
        pathname: location.pathname,
        query: {
          ...location.query,
          widths: dropRightWhile(widths, width => width === COL_WIDTH_UNDEFINED),
        },
      });
    },
    [columns, location.pathname, location.query]
  );

  return {
    columns: columnsWidthWidths,
    handleResizeColumn,
  };
}
