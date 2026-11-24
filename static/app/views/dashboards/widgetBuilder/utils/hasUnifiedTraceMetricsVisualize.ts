import type {Organization} from 'sentry/types/organization';

/**
 * One list of aggregates, fields and equations instead of the Series / Equation
 * toggle.
 */
export function hasUnifiedTraceMetricsVisualize(organization: Organization): boolean {
  return organization.features.includes('dashboards-trace-metrics-unified-visualize');
}
