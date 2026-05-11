import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {FALLBACK_TYPE} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/settings';
import type {
  CategoricalSeries,
  TabularData,
} from 'sentry/views/dashboards/widgets/common/types';

/**
 * Transforms table data from the /events/ endpoint into `CategoricalSeries` format
 * suitable for rendering in `CategoricalSeriesWidgetVisualization`, according to the
 * Widget Query that requested it.
 *
 * For categorical bar charts:
 * - query.columns[0] is the X-axis category field
 * - query.aggregates contains the Y-axis aggregate(s)
 *
 * Example transformation:
 * Input (TabularData):
 *   data: [{browser: 'Chrome', 'count()': 1250}, {browser: 'Firefox', 'count()': 890}]
 *   meta: {fields: {browser: 'string', 'count()': 'integer'}, units: {'count()': null}}
 *
 * Output (CategoricalSeries):
 *   valueAxis: 'count()'
 *   meta: {valueType: 'integer', valueUnit: null}
 *   values: [{category: 'Chrome', value: 1250}, {category: 'Firefox', value: 890}]
 */
export function transformTableToCategoricalSeries(
  query: WidgetQuery,
  tableData: TabularData
): CategoricalSeries[] {
  // The X-axis field is the first column (non-aggregate field)
  const xAxisField = query.columns[0];
  if (!xAxisField) {
    return [];
  }

  // Get the aggregate(s) - each creates a separate series
  const aggregates = query.aggregates;
  if (!aggregates || aggregates.length === 0) {
    return [];
  }

  const {meta, data: rows} = tableData;

  return aggregates.map(aggregate => {
    const valueType = meta.fields[aggregate];
    const valueUnit = meta.units[aggregate];

    // Transform rows to categorical items
    // Handle null/undefined/empty values distinctly from valid category values
    const values = rows.map(row => {
      // These values cannot be `undefined` as far as I know, but the types
      // suggest that they can
      const category = row[xAxisField] ?? null;
      const rawValue = row[aggregate];
      // CategoricalItemValue must be number | null, so coerce non-numeric values to null
      const value = typeof rawValue === 'number' ? rawValue : null;

      return {
        category,
        value,
      };
    });

    return {
      valueAxis: aggregate,
      meta: {
        valueType: valueType ?? FALLBACK_TYPE,
        valueUnit: valueUnit ?? null,
      },
      values,
    };
  });
}
