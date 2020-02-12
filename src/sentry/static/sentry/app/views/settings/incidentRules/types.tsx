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
  resolveThreshold: number | '' | null;
  actions: Action[];
};

export type ThresholdControlValue = {
  thresholdType: AlertRuleThresholdType;

  /**
   * Resolve threshold is optional, so it can be null
   */
  threshold: number | '' | null;
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
  environment: string[];
  query: string;
  timeWindow: number;
  triggers: Trigger[];
};

export type SavedIncidentRule = UnsavedIncidentRule & {
  dateCreated: string;
  dateModified: string;
  dataset: string;
  id: string;
  status: number;
  name: string;
};

export type IncidentRule = Partial<SavedIncidentRule> & UnsavedIncidentRule;

export enum TimeWindow {
  ONE_MINUTE = 1,
  FIVE_MINUTES = 5,
  TEN_MINUTES = 10,
  FIFTEEN_MINUTES = 15,
  THIRTY_MINUTES = 30,
  ONE_HOUR = 60,
  TWO_HOURS = 120,
  FOUR_HOURS = 240,
  ONE_DAY = 1440,
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

  // Human readable string describing what the action does.
  desc: string | null;
};
