import {IssueAlertRuleAction, IssueAlertRuleCondition} from 'sentry/types/alerts';

export interface AlertTemplate {
  id: string;
  issue_alert_data: {
    actionMatch: 'all' | 'any' | 'none';
    actions: IssueAlertRuleAction[];
    conditions: IssueAlertRuleCondition[];
    filterMatch: 'all' | 'any' | 'none';
    filters: IssueAlertRuleCondition[];
  };
  issue_alert_ids: number[];
  name: string;
  organization_id: number;
  owner: string | null;
  procedure: number | null;
}

export interface AlertProcedure {
  id: string;
  is_manual: boolean;
  issue_alert_actions: IssueAlertRuleAction[];
  label: string;
  organization_id: number;
  owner: string | null;
  // [type]:[identifer]
  templates: number[];
}
