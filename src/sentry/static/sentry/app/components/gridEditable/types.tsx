/**
 * For GridEditable, there are 2 generic types for the component, T and K
 * - T is an element/object that represents the data to be displayed
 * - K is a key of T
 *   - columnKey should have the same set of values as K
 */

export type ObjectKey = React.ReactText;

export type GridColumn<K = ObjectKey> = {
  key: K;
  width?: number;
};

export type GridColumnHeader<K = ObjectKey> = GridColumn<K> & {
  name: string;
};

export type GridColumnOrder<K = ObjectKey> = GridColumnHeader<K>;
export type GridColumnSortBy<K = ObjectKey> = GridColumn<K> & {
  order: 'desc' | 'asc';
};
