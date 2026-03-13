import type {DashboardFilters} from 'sentry/views/dashboards/types';
import {DEFAULT_TRACES_TABLE_WIDTHS} from 'sentry/views/dashboards/utils/prebuiltConfigs/ai/aiAgentsOverview';
import {useTraceViewDrawer} from 'sentry/views/insights/pages/agents/components/drawer';
import {TracesTable} from 'sentry/views/insights/pages/agents/components/tracesTable';

interface AgentsTracesTableWidgetVisualizationProps {
  dashboardFilters?: DashboardFilters;
  frameless?: boolean;
  limit?: number;
  tableWidths?: number[];
}

export function AgentsTracesTableWidgetVisualization({
  limit,
  tableWidths = DEFAULT_TRACES_TABLE_WIDTHS,
  dashboardFilters,
  frameless,
}: AgentsTracesTableWidgetVisualizationProps) {
  const {openTraceViewDrawer} = useTraceViewDrawer();

  return (
    <TracesTable
      openTraceViewDrawer={openTraceViewDrawer}
      limit={limit}
      tableWidths={tableWidths}
      dashboardFilters={dashboardFilters}
      frameless={frameless}
    />
  );
}
