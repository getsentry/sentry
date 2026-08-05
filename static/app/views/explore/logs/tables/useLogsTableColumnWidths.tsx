import {useEffect, useState, type RefObject} from 'react';

import {useWindowSize} from 'sentry/utils/window/useWindowSize';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

type ColumnWidths = Record<string, number | string>;

const FLEX_COLUMN_WIDTH = 'minmax(90px, 1fr)';

type LogsTableColumnWidthOptions = {
  dataLength: number;
  fields: readonly string[];
  isPending: boolean;
  isScrolling: boolean;
  tableRef: RefObject<HTMLElement | null>;
};

// The flexible track is the message column when present, otherwise the last
// column so the table stays width-filled. Everything else is locked to pixels
// while scrolling. Keeping the same flex column before and after locking means
// no column ever flips between `auto` and `1fr` on the first scroll.
function flexColumnIndex(fields: readonly string[]) {
  const messageIndex = fields.indexOf(OurLogKnownFieldKey.MESSAGE);
  return messageIndex === -1 ? fields.length - 1 : messageIndex;
}

function getDefaultColumnWidths(fields: readonly string[]) {
  const flexField = fields[flexColumnIndex(fields)];
  return flexField ? {[flexField]: FLEX_COLUMN_WIDTH} : {};
}

function useFieldsColumnWidths(fields: readonly string[]) {
  const [columnWidths, setColumnWidths] = useState<ColumnWidths | undefined>();
  const windowSize = useWindowSize();

  const fieldsKey = fields.join('\u0000');

  // Reset only when the fields actually change or the window resizes, not on
  // every new `fields` array identity (sort/search/date all mint a new array).
  useEffect(() => {
    setColumnWidths(undefined);
  }, [fieldsKey, windowSize]);

  return [columnWidths, setColumnWidths] as const;
}

export function useLogsTableColumnWidths({
  fields,
  tableRef,
  isPending,
  isScrolling,
  dataLength,
}: LogsTableColumnWidthOptions): ColumnWidths {
  const [columnWidths, setColumnWidths] = useFieldsColumnWidths(fields);

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

    // The grid has a leading prefix (chevron) track, so field `i` is track `i + 1`.
    const domWidths = getComputedStyle(tableRef.current).gridTemplateColumns.split(/\s+/);
    if (domWidths.length < fields.length + 1) {
      return;
    }

    const flexIndex = flexColumnIndex(fields);
    const widths: ColumnWidths = {};

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i]!;
      if (i === flexIndex) {
        widths[field] = FLEX_COLUMN_WIDTH;
        continue;
      }

      const px = parseFloat(domWidths[i + 1]!);
      if (!Number.isFinite(px)) {
        return;
      }

      widths[field] = px;
    }

    setColumnWidths(widths);
  }, [
    columnWidths,
    dataLength,
    fields,
    isPending,
    isScrolling,
    setColumnWidths,
    tableRef,
  ]);

  return columnWidths ?? getDefaultColumnWidths(fields);
}
