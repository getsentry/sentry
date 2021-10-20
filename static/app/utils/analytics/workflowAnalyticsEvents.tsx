export type TeamInsightsEventParameters = {
  'team_insights.viewed': {};
};

export type TeamInsightsEventKey = keyof TeamInsightsEventParameters;

export const workflowEventMap: Record<TeamInsightsEventKey, string | null> = {
  'team_insights.viewed': 'Team Insights: Viewed',
};
