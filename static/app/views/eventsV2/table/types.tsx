import {GridColumnOrder, GridColumnSortBy} from 'sentry/components/gridEditable';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {
  AggregateParameter,
  Column,
  ColumnType,
  ColumnValueType,
} from 'sentry/utils/discover/fields';
import {MetricsColumnType} from 'sentry/views/dashboardsV2/widget/metricWidget/fields';

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

export enum FieldValueKind {
  TAG = 'tag',
  MEASUREMENT = 'measurement',
  BREAKDOWN = 'breakdown',
  FIELD = 'field',
  FUNCTION = 'function',
  EQUATION = 'equation',
  METRIC = 'metric',
}

export type FieldValueColumns =
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
      kind: FieldValueKind.MEASUREMENT;
      meta: {
        name: string;
        dataType: ColumnType;
      };
    }
  | {
      kind: FieldValueKind.BREAKDOWN;
      meta: {
        name: string;
        dataType: 'duration';
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
      kind: FieldValueKind.METRIC;
      meta: {
        name: string;
        dataType: MetricsColumnType;
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
    };
