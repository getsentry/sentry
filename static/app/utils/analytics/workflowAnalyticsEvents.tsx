type RuleViewed = {
  alert_type: 'issue' | 'metric';
  project_id: string;
};

export type TeamInsightsEventParameters = {
  'alert_builder.filter': {query: string; session_id?: string};
  'alert_details.viewed': {alert_id: number};
  'alert_rule_details.viewed': {alert: string; rule_id: number};
  'alert_rules.viewed': {sort: string};
  'alert_stream.edit_clicked': {rule_id: number};
  'alert_stream.viewed': {rule_id: number};
  'alert_wizard.option_selected': {alert_type: string};
  'alert_wizard.option_viewed': {alert_type: string};
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
  'alert_builder.filter': 'Alert Builder: Filter',
  'alert_details.viewed': 'Alert Details: Viewed',
  'alert_rule_details.viewed': 'Alert Rule Details: Viewed',
  'alert_rules.viewed': 'Alert Rules: Viewed',
  'alert_stream.edit_clicked': 'Alert Stream: Edit Clicked',
  'alert_stream.viewed': 'Alert Stream: Viewed',
  'alert_wizard.option_selected': 'Alert Wizard: Option Selected',
  'alert_wizard.option_viewed': 'Alert Wizard: Option Viewed',
  'edit_alert_rule.add_row': 'Edit Alert Rule: Add Row',
  'edit_alert_rule.viewed': 'Edit Alert Rule: Viewed',
  'new_alert_rule.viewed': 'New Alert Rule: Viewed',
  'team_insights.viewed': 'Team Insights: Viewed',
};
