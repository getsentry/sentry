import {useTraceViewDrawer} from 'sentry/views/insights/pages/agents/components/drawer';
import {TracesTable} from 'sentry/views/insights/pages/agents/components/tracesTable';

interface AgentsTracesTableWidgetVisualizationProps {
  limit?: number;
  tableWidths?: number[];
}

export function AgentsTracesTableWidgetVisualization({
  limit,
  tableWidths,
}: AgentsTracesTableWidgetVisualizationProps) {
  const {openTraceViewDrawer} = useTraceViewDrawer();

  return (
    <TracesTable
      openTraceViewDrawer={openTraceViewDrawer}
      limit={limit}
      tableWidths={tableWidths}
      frameless
    />
  );
}
