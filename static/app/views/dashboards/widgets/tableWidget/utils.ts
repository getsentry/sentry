import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type {
  TabularColumn,
  TabularData,
  TabularValueUnit,
} from 'sentry/views/dashboards/widgets/common/types';

/**
 * Converts the TableData type to TabularData type
 * @param tableData
 * @returns `TabularData`
 */
export function convertTableDataToTabularData(tableData?: TableData): TabularData {
  return {
    data: tableData?.data ?? [],
    meta: {
      units: tableData?.meta?.units as Record<string, TabularValueUnit>,
      fields: tableData?.meta?.fields,
    },
  };
}

/**
 * Takes columns and field aliases list, converting them to a record for `TableWidgetVisualization`.
 * If field header map is supplied, it will combine them, giving priority to field aliases on
 * duplicate keys
 *
 * @param columns a `TabularColumn[]`. Length and order must match `fieldAliases`
 * @param fieldAliases a list of strings. Length and order must match `columns`
 * @param fieldHeaderMap optional `Record<string, string>` to combine `fieldAliases` with
 */
export function decodeColumnAliases(
  columns: TabularColumn[],
  fieldAliases: string[],
  fieldHeaderMap?: Record<string, string>
): Record<string, string> {
  if (columns.length !== fieldAliases.length) {
    return fieldHeaderMap ?? {};
  }
  const fieldAliasesMap: Record<string, string> = {};
  columns.forEach((column, index) => {
    fieldAliasesMap[column.key] =
      (fieldAliases[index] || fieldHeaderMap?.[column.key]) ?? '';
  });

  return fieldAliasesMap;
}
