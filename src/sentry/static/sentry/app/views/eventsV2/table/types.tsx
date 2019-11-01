import {GridColumnOrder, GridColumnSortBy} from 'app/components/gridEditable';

import {ColumnValueType, Aggregation, Field} from '../eventQueryParams';
import {Field as FieldType} from '../eventView';
import {MetaType} from '../utils';

/**
 * It is assumed that `aggregation` and `field` have the same ColumnValueType
 */
export type TableColumn<K> = GridColumnOrder<K> & {
  // key: K                     From GridColumn
  // name: string               From GridColumnHeader
  aggregation: Aggregation;
  field: Field;
  eventViewField: Readonly<FieldType>;

  type: ColumnValueType;
  isSortable: boolean;
  // isPrimary: boolean         From GridColumnHeader
};

export type TableColumnSort<K> = GridColumnSortBy<K>;

export type TableState = {
  columnOrder: TableColumn<keyof TableDataRow>[];
  columnSortBy: TableColumnSort<keyof TableDataRow>[];
};

export type TableDataRow = {
  [key: string]: React.ReactText;
};

export type TableData = {
  meta?: MetaType;
  data: Array<TableDataRow>;
};
