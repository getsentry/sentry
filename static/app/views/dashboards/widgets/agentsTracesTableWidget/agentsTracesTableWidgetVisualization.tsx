import {DEFAULT_TRACES_TABLE_WIDTHS} from 'sentry/views/dashboards/utils/prebuiltConfigs/ai/aiAgentsOverview';
import {useTraceViewDrawer} from 'sentry/views/insights/pages/agents/components/drawer';
import {TracesTable} from 'sentry/views/insights/pages/agents/components/tracesTable';

interface AgentsTracesTableWidgetVisualizationProps {
  frameless?: boolean;
  limit?: number;
  tableWidths?: number[];
}

export function AgentsTracesTableWidgetVisualization({
  limit,
  tableWidths = DEFAULT_TRACES_TABLE_WIDTHS,
  frameless,
}: AgentsTracesTableWidgetVisualizationProps) {
  const {openTraceViewDrawer} = useTraceViewDrawer();

  return (
    <TracesTable
      openTraceViewDrawer={openTraceViewDrawer}
      limit={limit}
      tableWidths={tableWidths}
      frameless={frameless}
    />
  );
}
