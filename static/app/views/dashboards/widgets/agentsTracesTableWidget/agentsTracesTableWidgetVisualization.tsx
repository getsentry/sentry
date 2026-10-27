import type {DashboardFilters} from 'sentry/views/dashboards/types';
import {TracesTable} from 'sentry/views/insights/pages/agents/components/tracesTable';

interface AgentsTracesTableWidgetVisualizationProps {
  dashboardFilters?: DashboardFilters;
  frameless?: boolean;
  limit?: number;
  tableWidths?: number[];
}

export function AgentsTracesTableWidgetVisualization({
  limit,
  tableWidths,
  dashboardFilters,
  frameless,
}: AgentsTracesTableWidgetVisualizationProps) {
  return (
    <TracesTable
      agentFilterMode="dashboard-global"
      limit={limit}
      tableWidths={tableWidths}
      dashboardFilters={dashboardFilters}
      frameless={frameless}
    />
  );
}
