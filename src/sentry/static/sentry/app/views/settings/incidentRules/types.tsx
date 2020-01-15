export enum AlertRuleThreshold {
  INCIDENT,
  RESOLUTION,
}

export enum AlertRuleThresholdType {
  ABOVE,
  BELOW,
}

export enum AlertRuleAggregations {
  TOTAL,
  UNIQUE_USERS,
}

export type UnsavedTrigger = {
  // UnsavedTrigger can be apart of an Unsaved Alert Rule that does not have an id yet
  alertRuleId?: string;
  label: string;
  thresholdType: AlertRuleThresholdType;
  alertThreshold: number;
  resolveThreshold: number | '';
  actions: Action[];
};

export type ThresholdControlValue = {
  thresholdType: AlertRuleThresholdType;
  threshold: number | '';
};

export type SavedTrigger = UnsavedTrigger & {
  id: string;
  dateCreated: string;
};

export type Trigger = Partial<SavedTrigger> & UnsavedTrigger;

export type UnsavedIncidentRule = {
  aggregation: AlertRuleAggregations;
  aggregations: AlertRuleAggregations[];
  projects: string[];
  query: string;
  timeWindow: number;
  triggers: Trigger[];
};

export type SavedIncidentRule = UnsavedIncidentRule & {
  dateCreated: string;
  dateModified: string;
  id: string;
  status: number;
  name: string;
};

export type IncidentRule = Partial<SavedIncidentRule> & UnsavedIncidentRule;

export enum TimeWindow {
  ONE_MINUTE = 60,
  FIVE_MINUTES = 300,
  TEN_MINUTES = 600,
  FIFTEEN_MINUTES = 900,
  THIRTY_MINUTES = 1800,
  ONE_HOUR = 3600,
  TWO_HOURS = 7200,
  FOUR_HOURS = 14400,
  ONE_DAY = 86400,
}

export type ProjectSelectOption = {
  label: string;
  value: number;
};

export enum ActionType {
  EMAIL = 'email',
  SLACK = 'slack',
  PAGER_DUTY = 'pagerduty',
}

export enum TargetType {
  // The name can be customized for each integration. Email for email, channel for slack, service for Pagerduty). We probably won't support this for email at first, since we need to be careful not to enable spam
  SPECIFIC = 'specific',

  // Just works with email for now, grabs given user's email address
  USER = 'user',

  // Just works with email for now, grabs the emails for all team members
  TEAM = 'team',
}

export type Action = {
  id?: string;
  type: ActionType;

  targetType: TargetType | null;

  // How to identify the target. Can be email, slack channel, pagerduty service, user_id, team_id, etc
  targetIdentifier: string | null;
};
