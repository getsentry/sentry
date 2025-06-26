export type AgentMonitoringEventParameters = {
  'agent-monitoring.column-sort': {
    column: string;
    direction: 'asc' | 'desc';
    table: string;
  };
  'agent-monitoring.page-view': {
    isOnboarding: boolean;
  };
  'agent-monitoring.table-switch': {
    newTable: string;
    previousTable: string;
  };
};

export const agentMonitoringEventMap: Record<
  keyof AgentMonitoringEventParameters,
  string
> = {
  'agent-monitoring.page-view': 'Agent Monitoring: Page View',
  'agent-monitoring.table-switch': 'Agent Monitoring: Table Switch',
  'agent-monitoring.column-sort': 'Agent Monitoring: Column Sort',
};
