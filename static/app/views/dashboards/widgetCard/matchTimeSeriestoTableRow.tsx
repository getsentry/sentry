import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

/**
 * Converts a JS value to a string matching Python's str() output.
 * The backend converts group-by values using str(), so we need to
 * match that behavior for comparisons.
 */
function toPythonString(value: unknown): string {
  if (value === null) {
    return 'None';
  }
  if (typeof value === 'boolean') {
    return value ? 'True' : 'False';
  }
  if (Array.isArray(value)) {
    const elements = value.map(item => {
      if (item === null) {
        return 'None';
      }
      if (typeof item === 'string') {
        return `'${item}'`;
      }
      if (typeof item === 'number') {
        return item.toString();
      }
      // Fallback for unexpected types in array
      return String(item);
    });
    return `[${elements.join(', ')}]`;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  // Fallback for unexpected types (should never be reached with valid GroupBy values)
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(value);
}

/**
 * Finds the value of a given yAxis in table data that matches the
 * time series groupBy values. Used by the breakdown legend to display
 * aggregated values alongside each series.
 */
export function matchTimeSeriesToTableRow({
  tableDataRows,
  timeSeries,
}: {
  tableDataRows: TableDataRow[];
  timeSeries: Pick<TimeSeries, 'groupBy' | 'yAxis'>;
}): number | null {
  const {groupBy, yAxis} = timeSeries;

  if (!groupBy || groupBy.length === 0) {
    // No groupBy means a single aggregated row
    // Table results will be `[{aggregate1: 123}, {aggregate2: 345}]`
    const row = tableDataRows[0];
    return (row?.[yAxis] as number) ?? null;
  }

  const matchedRow = tableDataRows.find(row =>
    groupBy.every(group => toPythonString(row[group.key]) === toPythonString(group.value))
  );

  return (matchedRow?.[yAxis] as number) ?? null;
}
