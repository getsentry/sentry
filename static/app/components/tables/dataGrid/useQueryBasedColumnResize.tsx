import {useCallback, useMemo} from 'react';
import dropRightWhile from 'lodash/dropRightWhile';
import {parseAsNativeArrayOf, parseAsString, useQueryState} from 'nuqs';

import {COL_WIDTH_UNDEFINED} from '@sentry/scraps/table';

import type {GridColumnOrder} from 'sentry/components/tables/dataGrid';
import {decodeInteger} from 'sentry/utils/queryString';

// Widths are positional, so blank entries must not be dropped like parseAsStringArray does.
const widthParser = parseAsNativeArrayOf(parseAsString);

interface Props<Col extends GridColumnOrder<unknown>> {
  columns: Col[];
}

export function useQueryBasedColumnResize<Col extends GridColumnOrder<unknown>>({
  columns,
}: Props<Col>) {
  const [widthParam, setWidthParam] = useQueryState('width', widthParser);
  const columnsWidthWidths = useMemo(
    () =>
      columns.map((column, i) => ({
        ...column,
        width: decodeInteger(widthParam[i], column.width ?? COL_WIDTH_UNDEFINED),
      })),
    [columns, widthParam]
  );

  const handleResizeColumn = useCallback(
    (columnIndex: number, resizedColumn: Col) => {
      const widths = columnsWidthWidths.map(
        (column, i) =>
          (i === columnIndex ? resizedColumn.width : column.width) ?? COL_WIDTH_UNDEFINED
      );
      setWidthParam(
        dropRightWhile(widths, width => width === COL_WIDTH_UNDEFINED).map(String)
      );
    },
    [columnsWidthWidths, setWidthParam]
  );

  return {
    columns: columnsWidthWidths,
    handleResizeColumn,
  };
}
