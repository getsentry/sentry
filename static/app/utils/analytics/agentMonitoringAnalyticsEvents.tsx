export type AgentMonitoringEventParameters = {
  'agent-monitoring.page-view': {
    isOnboarding: boolean;
  };
  'agent-monitoring.table-switch': {
    previousTable: string;
    newTable: string;
  };
  'agent-monitoring.column-sort': {
    table: string;
    column: string;
    direction: 'asc' | 'desc';
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

export type AgentMonitoringEventKey = keyof typeof agentMonitoringEventMap;
