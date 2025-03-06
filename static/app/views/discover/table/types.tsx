import type {GridColumnOrder, GridColumnSortBy} from 'sentry/components/gridEditable';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {
  AggregateParameter,
  Column,
  ColumnType,
  ColumnValueType,
} from 'sentry/utils/discover/fields';

/**
 * It is assumed that `aggregation` and `field` have the same ColumnValueType
 */
export type TableColumn<K> = GridColumnOrder<K> & {
  // key: K                     From GridColumn
  // name: string               From GridColumnHeader
  column: Readonly<Column>;
  isSortable: boolean;

  type: ColumnValueType;
  width?: number;
  // isPrimary: boolean         From GridColumnHeader
};

export type TableColumnSort<K> = GridColumnSortBy<K>;

export type TableState = {
  columnOrder: Array<TableColumn<keyof TableDataRow>>;
  columnSortBy: Array<TableColumnSort<keyof TableDataRow>>;
};

export enum FieldValueKind {
  TAG = 'tag',
  MEASUREMENT = 'measurement',
  CUSTOM_MEASUREMENT = 'custom_measurement',
  BREAKDOWN = 'breakdown',
  FIELD = 'field',
  FUNCTION = 'function',
  EQUATION = 'equation',
  METRICS = 'metric',
  NUMERIC_METRICS = 'numeric_metric',
}

export type FieldValueColumns =
  | {
      kind: FieldValueKind.TAG;
      meta: {
        dataType: ColumnType;
        name: string;
        // Set to true for tag values we invent at runtime.
        unknown?: boolean;
      };
    }
  | {
      kind: FieldValueKind.MEASUREMENT;
      meta: {
        dataType: ColumnType;
        name: string;
      };
    }
  | {
      kind: FieldValueKind.CUSTOM_MEASUREMENT;
      meta: {
        dataType: ColumnType;
        functions: string[];
        name: string;
      };
    }
  | {
      kind: FieldValueKind.BREAKDOWN;
      meta: {
        dataType: 'duration';
        name: string;
      };
    }
  | {
      kind: FieldValueKind.FIELD;
      meta: {
        dataType: ColumnType;
        name: string;
      };
    }
  | {
      kind: FieldValueKind.METRICS;
      meta: {
        dataType: ColumnType;
        name: string;
      };
    }
  | {
      kind: FieldValueKind.NUMERIC_METRICS;
      meta: {
        dataType: 'number';
        name: string;
      };
    };

// Payload of select options in the column editor.
// The first column contains a union of tags, fields and functions,
// and we need ways to disambiguate them.
export type FieldValue =
  | FieldValueColumns
  | {
      kind: FieldValueKind.FUNCTION;
      meta: {
        name: string;
        parameters: AggregateParameter[];
      };
    }
  | {
      kind: FieldValueKind.EQUATION;
      meta: {
        name: string;
      };
    };
