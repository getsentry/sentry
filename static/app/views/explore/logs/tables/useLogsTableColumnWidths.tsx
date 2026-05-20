import {useCallback, useEffect, useState, type RefObject} from 'react';

import {useWindowSize} from 'sentry/utils/window/useWindowSize';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

type ColumnWidths = Record<string, number | string>;

const DEFAULT_COLUMN_WIDTHS = {
  [OurLogKnownFieldKey.MESSAGE]: 'minmax(90px,1fr)',
};

type LogsTableColumnWidthOptions = {
  dataLength: number;
  fields: readonly string[];
  isPending: boolean;
  isScrolling: boolean;
  tableRef: RefObject<HTMLElement | null>;
};

export function useLogsTableColumnWidths({
  fields,
  tableRef,
  isPending,
  isScrolling,
  dataLength,
}: LogsTableColumnWidthOptions) {
  const [columnWidths, setColumnWidths] = useState<ColumnWidths | undefined>();
  const windowSize = useWindowSize();

  const clearColumnWidths = useCallback(() => setColumnWidths(undefined), []);

  useEffect(() => {
    setColumnWidths(undefined);
  }, [fields, windowSize]);

  useEffect(() => {
    if (
      !dataLength ||
      !isScrolling ||
      !tableRef.current ||
      columnWidths !== undefined ||
      isPending
    ) {
      return;
    }

    const domWidths = getComputedStyle(tableRef.current).gridTemplateColumns.split(/\s+/);

    setColumnWidths(
      Object.fromEntries(
        fields.map((field, i) => {
          if (field === OurLogKnownFieldKey.MESSAGE) {
            return [field, DEFAULT_COLUMN_WIDTHS[field]];
          }
          if (i === fields.length - 1) {
            return [field, 'minmax(0px, 1fr)'];
          }
          return [field, parseFloat(domWidths[i + 1]!)];
        })
      )
    );
  }, [isScrolling, isPending, dataLength, columnWidths, fields, tableRef]);

  return [columnWidths ?? DEFAULT_COLUMN_WIDTHS, clearColumnWidths] as const;
}
