import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/common/types';

/**
 * Formats a unique name for a categorical series, used internally by ECharts.
 * Combines valueAxis with groupBy information to create unique series names.
 */
export function formatCategoricalSeriesName(series: CategoricalSeries): string {
  let name = `${series.valueAxis}`;

  if (series.groupBy?.length) {
    name += ` : ${series.groupBy
      .map(groupBy => {
        const value = Array.isArray(groupBy.value)
          ? JSON.stringify(groupBy.value)
          : groupBy.value;
        return `${groupBy.key} : ${value}`;
      })
      .join(',')}`;
  }

  return name;
}
