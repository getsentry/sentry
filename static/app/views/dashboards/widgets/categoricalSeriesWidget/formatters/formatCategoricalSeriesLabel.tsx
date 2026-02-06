import {t} from 'sentry/locale';
import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/common/types';

/**
 * Formats a user-friendly label for a categorical series, used in legends and tooltips.
 * If groupBy is present, shows just the groupBy values (no need to repeat the valueAxis).
 * Otherwise, falls back to the valueAxis.
 */
export function formatCategoricalSeriesLabel(series: CategoricalSeries): string {
  if (series.groupBy?.length && series.groupBy.length > 0) {
    return series.groupBy
      .map(groupBy => {
        if (Array.isArray(groupBy.value)) {
          return JSON.stringify(groupBy.value);
        }

        if (groupBy.value === null) {
          return t('(no value)');
        }

        return `${groupBy.value}`;
      })
      .join(',');
  }

  return series.valueAxis;
}
