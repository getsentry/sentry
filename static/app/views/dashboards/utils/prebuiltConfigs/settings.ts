import {t} from 'sentry/locale';

/**
 * Minimum height (in grid rows) for table widgets in prebuilt dashboards.
 */
export const TABLE_MIN_HEIGHT = 2;

/**
 * Common field alias labels used across prebuilt dashboards.
 * Keeps column headings consistent and avoids duplicated strings.
 */
export const FIELD_ALIASES = {
  avg: t('Avg'),
  avgDuration: t('Avg Duration'),
  calls: t('Calls'),
  count: t('Count'),
  errorRate: t('Error Rate'),
  errors: t('Errors'),
  model: t('Model'),
  operation: t('Operation'),
  p50: 'P50',
  p75: 'P75',
  p95: 'P95',
  p95Duration: t('P95 Duration'),
  project: t('Project'),
  requests: t('Requests'),
  spanDescription: t('Span Description'),
  timeSpent: t('Time Spent'),
  tool: t('Tool'),
  transaction: t('Transaction'),
  users: t('Users'),
  views: t('Views'),
} as const;
