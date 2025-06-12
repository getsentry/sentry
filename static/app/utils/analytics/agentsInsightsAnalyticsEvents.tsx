type AgentsInsightsEventParameters = {
  'agents-insights.page-view': Record<string, unknown>;
  'agents-insights.table_view_change': {
    isEnabled: boolean;
  };
};

export const agentsInsightsEventMap: Record<keyof AgentsInsightsEventParameters, string> =
  {
    'agents-insights.page-view': 'Agents Insights: Page View',
    'agents-insights.table_view_change': 'Agents Insights: Table View Change',
  };
