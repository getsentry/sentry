type RuleViewed = {
  alert_type: 'issue' | 'metric';
  project_id: string;
};

export type TeamInsightsEventParameters = {
  'edit_alert_rule.add_row': {
    name: string;
    project_id: string;
    type: string;
  };
  'edit_alert_rule.viewed': RuleViewed;
  'new_alert_rule.viewed': RuleViewed & {
    session_id: string;
  };
  'team_insights.viewed': {};
};

export type TeamInsightsEventKey = keyof TeamInsightsEventParameters;

export const workflowEventMap: Record<TeamInsightsEventKey, string | null> = {
  'team_insights.viewed': 'Team Insights: Viewed',
  'edit_alert_rule.viewed': 'Edit Alert Rule: Viewed',
  'new_alert_rule.viewed': 'New Alert Rule: Viewed',
  'edit_alert_rule.add_row': 'Edit Alert Rule: Add Row',
};
