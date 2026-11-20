import type {Organization} from 'sentry/types/organization';

/**
 * Whether the trace metrics widget builder shows aggregates, fields and
 * equations in one list instead of the Series / Equation toggle.
 */
export function hasUnifiedTraceMetricsVisualize(organization: Organization): boolean {
  return organization.features.includes('dashboards-trace-metrics-unified-visualize');
}
