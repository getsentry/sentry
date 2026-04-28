// For GridEditable, there are 2 generic types for the component, T and K
//
// - T is an element/object that represents the data to be displayed
// - K is a key of T/
//   - columnKey should have the same set of values as K

type ObjectKey = string | number;

export type GridColumn<K = ObjectKey> = {
  key: K;
  width?: number;
};

export type GridColumnHeader<K = ObjectKey> = GridColumn<K> & {
  name: string;
  tooltip?: React.ReactNode;
};

export type GridColumnOrder<K = ObjectKey> = GridColumnHeader<K>;

export type GridColumnSortBy<K = ObjectKey> = GridColumn<K> & {
  order: 'desc' | 'asc';
};

/**
 * Store state at the start of "resize" action
 */
export type ColResizeMetadata = {
  columnIndex: number; // Column being resized
  columnWidth: number; // Column width at start of resizing
  cursorX: number; // X-coordinate of cursor on window
};

export type GridData<
  DataRow,
  Order extends GridColumnOrder<unknown> = GridColumnOrder<keyof DataRow>,
> = {
  onResizeColumn?: (columnIndex: number, nextColumn: Order) => void;
  prependColumnWidths?: string[];
  renderBodyCell?: (
    column: Order,
    dataRow: DataRow,
    rowIndex: number,
    columnIndex: number
  ) => React.ReactNode;
  renderHeadCell?: (column: Order, columnIndex: number) => React.ReactNode;
  renderPrependColumns?: (
    isHeader: boolean,
    dataRow?: DataRow,
    rowIndex?: number
  ) => React.ReactNode[];
};
