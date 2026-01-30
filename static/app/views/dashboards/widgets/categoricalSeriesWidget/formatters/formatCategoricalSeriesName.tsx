import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/types';

/**
 * Formats a unique name for a categorical series, used internally by ECharts.
 * Combines valueAxis with groupBy information to create unique series names.
 */
export function formatCategoricalSeriesName(series: CategoricalSeries): string {
  let name = `${series.valueAxis}`;

  if (series.groupBy?.length) {
    name += ` : ${series.groupBy
      .map(groupBy => {
        return `${groupBy.key} : ${groupBy.value}`;
      })
      .join(',')}`;
  }

  return name;
}
