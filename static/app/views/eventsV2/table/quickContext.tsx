import {TableDataRow} from 'sentry/utils/discover/discoverQuery';

import {TableColumn} from './types';

const UNKNOWN_ISSUE = 'unknown';

// Will extend this enum as we add contexts for more columns
export enum ColumnType {
  ISSUE = 'issue',
}

export function hasContext(
  dataRow: TableDataRow,
  column: TableColumn<keyof TableDataRow>
): boolean {
  return column.column.field === ColumnType.ISSUE && dataRow.issue !== UNKNOWN_ISSUE;
}
