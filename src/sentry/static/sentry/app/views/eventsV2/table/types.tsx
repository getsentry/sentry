import {GridColumnOrder, GridColumnSortBy} from 'app/components/gridEditable';
import {MetaType} from 'app/utils/discover/eventView';
import {
  Column,
  ColumnType,
  ColumnValueType,
  AggregateParameter,
} from 'app/utils/discover/fields';

/**
 * It is assumed that `aggregation` and `field` have the same ColumnValueType
 */
export type TableColumn<K> = GridColumnOrder<K> & {
  // key: K                     From GridColumn
  // name: string               From GridColumnHeader
  column: Readonly<Column>;
  width?: number;

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

export enum FieldValueKind {
  TAG = 'tag',
  FIELD = 'field',
  FUNCTION = 'function',
}

// Payload of select options in the column editor.
// The first column contains a union of tags, fields and functions,
// and we need ways to disambiguate them.
export type FieldValue =
  | {
      kind: FieldValueKind.TAG;
      meta: {
        name: string;
        dataType: ColumnType;
        // Set to true for tag values we invent at runtime.
        unknown?: boolean;
      };
    }
  | {
      kind: FieldValueKind.FIELD;
      meta: {
        name: string;
        dataType: ColumnType;
      };
    }
  | {
      kind: FieldValueKind.FUNCTION;
      meta: {
        name: string;
        parameters: AggregateParameter[];
      };
    };
