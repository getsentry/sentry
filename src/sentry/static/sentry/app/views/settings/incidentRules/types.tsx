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
  alertRuleId: string;
  label: string;
  thresholdType: AlertRuleThresholdType;
  alertThreshold: number;
  resolveThreshold: number;
  timeWindow: number;
};

export type SavedTrigger = UnsavedTrigger & {
  id: string;
  dateAdded: string;
};

export type Trigger = Partial<SavedTrigger> & UnsavedTrigger;

export type IncidentRule = {
  aggregations: number[];
  aggregation?: number;
  alertThreshold: number;
  dataset: 'events';
  dateAdded: string;
  dateModified: string;
  id: string;
  name: string;
  projectId: string;
  query: string;
  resolution: number;
  resolveThreshold: number;
  status: number;
  thresholdPeriod: number;
  thresholdType: number;
  timeWindow: number;
  triggers: Trigger[];
};

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
