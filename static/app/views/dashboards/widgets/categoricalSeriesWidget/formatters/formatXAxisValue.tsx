import {t} from 'sentry/locale';
import type {CategoricalItemCategory} from 'sentry/views/dashboards/widgets/common/types';

/**
 * Format a category value for display on the X axis of a categorical chart.
 *
 * This function converts the raw category value (which can be various types
 * from a TabularRow) into a string suitable for display. This is analogous
 * to how formatYAxisValue handles numeric values for the Y axis.
 *
 * Note: Truncation should be handled separately by the caller (e.g., using
 * truncationFormatter) since different contexts may need different truncation.
 *
 * @param value The raw category value from a CategoricalItem
 * @returns A string representation suitable for display
 */
export function formatXAxisValue(value: CategoricalItemCategory): string {
  if (value === null || value === undefined) {
    return t('(empty)');
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return value.toLocaleString();
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (Array.isArray(value)) {
    // For string arrays, join with comma
    // Filter out null values and format each element
    return value.map(item => (item === null ? t('(empty)') : String(item))).join(', ');
  }

  // Fallback for any unexpected types
  return String(value);
}
