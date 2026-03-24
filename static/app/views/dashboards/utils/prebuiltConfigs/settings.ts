import {t} from 'sentry/locale';

/**
 * Minimum height (in grid rows) for table widgets in prebuilt dashboards.
 */
export const TABLE_MIN_HEIGHT = 2;

/**
 * Common field alias labels used across prebuilt dashboards.
 * Keeps column headings consistent and avoids duplicated strings.
 */
export const WIDGET_COLUMN_LABELS = {
  avg: t('Avg'),
  count: t('Count'),
  p50: 'P50',
  p75: 'P75',
  p95: 'P95',
  timeSpent: t('Time Spent'),
  transaction: t('Transaction'),
} as const;
