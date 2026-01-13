export type AgentMonitoringEventParameters = {
  'agent-monitoring.column-sort': {
    column: string;
    direction: 'asc' | 'desc';
    table: string;
  };
  'agent-monitoring.copy-llm-prompt-click': Record<string, unknown>;
  'agent-monitoring.drawer.open': Record<string, unknown>;
  'agent-monitoring.drawer.span-select': Record<string, unknown>;
  'agent-monitoring.drawer.view-full-trace-click': Record<string, unknown>;
  'agent-monitoring.page-view': {
    isOnboarding: boolean;
  };
  'agent-monitoring.table-switch': {
    newTable: string;
    previousTable: string;
  };
  'agent-monitoring.trace.rendered': Record<string, unknown>;
  'agent-monitoring.trace.span-select': Record<string, unknown>;
  'agent-monitoring.trace.view-full-trace-click': Record<string, unknown>;

  'agent-monitoring.view-ai-trace-click': Record<string, unknown>;
};

export const agentMonitoringEventMap: Record<
  keyof AgentMonitoringEventParameters,
  string
> = {
  'agent-monitoring.copy-llm-prompt-click': 'Agent Monitoring: Copy LLM Prompt Click',
  'agent-monitoring.page-view': 'Agent Monitoring: Page View',
  'agent-monitoring.table-switch': 'Agent Monitoring: Table Switch',
  'agent-monitoring.column-sort': 'Agent Monitoring: Column Sort',
  'agent-monitoring.drawer.open': 'Agent Monitoring: Drawer Open',
  'agent-monitoring.drawer.span-select': 'Agent Monitoring: Span Select',
  'agent-monitoring.drawer.view-full-trace-click':
    'Agent Monitoring: View Full Trace Click',
  'agent-monitoring.trace.rendered': 'Agent Monitoring: Trace Rendered',
  'agent-monitoring.trace.span-select': 'Agent Monitoring: Trace Span Select',
  'agent-monitoring.trace.view-full-trace-click':
    'Agent Monitoring: Trace View Full Trace Click',
  'agent-monitoring.view-ai-trace-click': 'Agent Monitoring: View AI Trace Clicked',
};
