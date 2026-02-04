import {t} from 'sentry/locale';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {PLOTTABLE_TIME_SERIES_VALUE_TYPES} from 'sentry/views/dashboards/widgets/common/settings';
import type {
  CategoricalSeries,
  CategoricalValueType,
  TabularData,
  TabularValueType,
} from 'sentry/views/dashboards/widgets/common/types';

interface TransformOptions {
  query: WidgetQuery;
  tableData: TabularData;
}

/**
 * Transforms table data from the /events/ endpoint into CategoricalSeries format
 * suitable for rendering in CategoricalSeriesWidgetVisualization.
 *
 * For categorical bar charts:
 * - query.columns[0] is the X-axis category field
 * - query.aggregates contains the Y-axis aggregate(s)
 *
 * Example transformation:
 * Input (from /events/):
 *   data: [{browser: 'Chrome', 'count()': 1250}, {browser: 'Firefox', 'count()': 890}]
 *   meta: {fields: {browser: 'string', 'count()': 'integer'}, units: {'count()': null}}
 *
 * Output (CategoricalSeries):
 *   valueAxis: 'count()'
 *   meta: {valueType: 'integer', valueUnit: null}
 *   values: [{category: 'Chrome', value: 1250}, {category: 'Firefox', value: 890}]
 */
export function transformTableToCategoricalSeries({
  query,
  tableData,
}: TransformOptions): CategoricalSeries[] {
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
    // Get type and unit from metadata
    const fieldType = meta.fields[aggregate];
    const fieldUnit = meta.units[aggregate];

    // Transform rows to categorical items
    // Handle null/undefined/empty values distinctly from valid category values
    const values = rows.map(row => {
      const rawCategory = row[xAxisField];
      let category: string;
      if (rawCategory === null || rawCategory === undefined || rawCategory === '') {
        category = t('(empty)');
      } else {
        category = String(rawCategory);
      }
      return {
        category,
        value: typeof row[aggregate] === 'number' ? row[aggregate] : null,
      };
    });

    return {
      valueAxis: aggregate,
      meta: {
        valueType: mapToCategoricalValueType(fieldType),
        valueUnit: fieldUnit ?? null,
      },
      values,
    };
  });
}

/**
 * Maps TabularValueType to CategoricalValueType.
 * CategoricalValueType is a subset of the plottable value types.
 * Accepts undefined to handle cases where the field isn't in the metadata.
 */
function mapToCategoricalValueType(
  type: TabularValueType | undefined
): CategoricalValueType {
  if (!type) {
    return 'number';
  }

  // CategoricalValueType is constrained to PLOTTABLE_TIME_SERIES_VALUE_TYPES
  if (PLOTTABLE_TIME_SERIES_VALUE_TYPES.includes(type as CategoricalValueType)) {
    return type as CategoricalValueType;
  }

  // Default to 'number' for unsupported types
  return 'number';
}
