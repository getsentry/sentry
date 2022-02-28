import {GridColumnOrder} from 'sentry/components/gridEditable';
import {Trace} from 'sentry/types/profiling/core';

export type TableColumnKey = keyof Trace;

type NonTableColumnKey =
  | 'app_id'
  | 'device_locale'
  | 'device_manufacturer'
  | 'backtrace_available'
  | 'error_code'
  | 'error_code_name'
  | 'error_description'
  | 'span_annotations'
  | 'spans'
  | 'trace_annotations';

export type TableColumnOrders = Omit<
  Record<TableColumnKey, TableColumn>,
  NonTableColumnKey
>;

export type TableColumn = GridColumnOrder<TableColumnKey>;

export type TableDataRow = Omit<Record<TableColumnKey, any>, NonTableColumnKey> &
  Partial<Record<TableColumnKey, any>>;
