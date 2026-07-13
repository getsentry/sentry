export type McpMonitoringEventParameters = {
  'mcp-monitoring.page-view': {
    isOnboarding: boolean;
  };
};

export const mcpMonitoringEventMap: Record<keyof McpMonitoringEventParameters, string> = {
  'mcp-monitoring.page-view': 'MCP Monitoring: Page View',
};
