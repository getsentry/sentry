import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {toPythonString} from 'sentry/utils/string/toPythonString';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

/**
 * Finds the value of a given yAxis in table data that matches the
 * time series groupBy values. Used by the breakdown legend to display
 * aggregated values alongside each series.
 */
export function matchTimeSeriesToTableRowValue({
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

  // Group values are parsed from a comma-joined series name, so compare the
  // values joined on `,` until we migrate to /events-timeseries/, which returns
  // group by values in the response.
  const seriesKey = groupBy.map(group => toPythonString(group.value)).join(',');
  const matchedRow = tableDataRows.find(
    row => groupBy.map(group => toPythonString(row[group.key])).join(',') === seriesKey
  );

  return (matchedRow?.[yAxis] as number) ?? null;
}
