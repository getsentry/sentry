import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import type {Widget} from 'sentry/views/dashboards/types';
import {PLOTTABLE_TIME_SERIES_VALUE_TYPES} from 'sentry/views/dashboards/widgets/common/settings';
import type {
  CategoricalSeries,
  CategoricalValueType,
} from 'sentry/views/dashboards/widgets/common/types';

/**
 * Maps AggregationOutputType to CategoricalValueType.
 * CategoricalValueType is a subset of the plottable value types.
 */
function mapToCategoricalValueType(type: string | undefined): CategoricalValueType {
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

interface TransformOptions {
  tableData: TableDataWithTitle;
  widget: Widget;
}

/**
 * Transforms table data from the /events/ endpoint into CategoricalSeries format
 * suitable for rendering in CategoricalSeriesWidgetVisualization.
 *
 * For categorical bar charts:
 * - widget.queries[0].columns[0] is the X-axis category field
 * - widget.queries[0].aggregates contains the Y-axis aggregate(s)
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
  widget,
  tableData,
}: TransformOptions): CategoricalSeries[] {
  const query = widget.queries[0];
  if (!query) {
    return [];
  }

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

  const meta = tableData.meta as EventsMetaType | undefined;
  const rows = tableData.data || [];

  return aggregates.map(aggregate => {
    // Get type and unit from metadata
    const fieldType = meta?.fields?.[aggregate] as AggregationOutputType | undefined;
    const fieldUnit = meta?.units?.[aggregate] as DataUnit | undefined;

    return {
      valueAxis: aggregate,
      meta: {
        valueType: mapToCategoricalValueType(fieldType),
        valueUnit: fieldUnit ?? null,
      },
      values: rows.map(row => ({
        category: String(row[xAxisField] ?? ''),
        value: typeof row[aggregate] === 'number' ? row[aggregate] : null,
      })),
    };
  });
}
