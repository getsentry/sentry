import {Environment} from '.';

export type IssueAlertRuleAction = {
  id: string;
  name: string;
};

export type IssueAlertRuleCondition = {
  id: string;
  name: string;
};

// Issue-based alert rule
export type IssueAlertRule = {
  actionMatch: 'all' | 'any';
  actions: IssueAlertRuleAction[];
  conditions: IssueAlertRuleCondition[];
  dateCreated: string;
  environment: null | Environment;
  frequency: number;
  id: string;
  name: string;
};
