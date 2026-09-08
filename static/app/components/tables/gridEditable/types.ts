// For GridEditable, there are 2 generic types for the component, T and K
//
// - T is an element/object that represents the data to be displayed
// - K is a key of T/
//   - columnKey should have the same set of values as K

import type {LocationDescriptor} from 'history';

import type {
  ColumnAlign,
  SortDirection,
} from 'sentry/components/tables/sortableHeaderCell';

type ObjectKey = string | number;

export type {ColumnAlign};

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
 * How a column offers sorting. `to` navigates, `onSort` calls back; giving
 * neither renders a plain header that still announces `direction`.
 */
export interface GridColumnSort {
  align?: ColumnAlign;
  direction?: SortDirection;
  onSort?: (event: React.MouseEvent) => void;
  /**
   * Whether `to` should replace the history entry rather than pushing a new one.
   */
  replace?: boolean;
  /**
   * Sort destination to navigate to on sort.
   */
  to?: LocationDescriptor;
}

export type GridData<
  DataRow,
  Order extends GridColumnOrder<unknown> = GridColumnOrder<keyof DataRow>,
> = {
  getColumnSort?: (column: Order, columnIndex: number) => GridColumnSort | undefined;
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
  staticColumnWidths?: Record<string, number | string>;
};
