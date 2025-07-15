export type McpMonitoringEventParameters = {
  'mcp-monitoring.column-sort': {
    column: string;
    direction: 'asc' | 'desc';
    table: string;
  };
  'mcp-monitoring.page-view': {
    isOnboarding: boolean;
  };
  'mcp-monitoring.table-switch': {
    newTable: string;
    previousTable: string;
  };
};

export const mcpMonitoringEventMap: Record<
  keyof McpMonitoringEventParameters,
  string
> = {
  'mcp-monitoring.page-view': 'MCP Monitoring: Page View',
  'mcp-monitoring.table-switch': 'MCP Monitoring: Table Switch',
  'mcp-monitoring.column-sort': 'MCP Monitoring: Column Sort',
};