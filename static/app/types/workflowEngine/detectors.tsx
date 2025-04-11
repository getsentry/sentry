export type DetectorType = 'metric' | 'crons' | 'uptime';
export interface NewDetector {
  config: Record<string, unknown>;
  dataCondition: DataConditionGroup;
  dataSource: DataSource;
  disabled: boolean;
  name: string;
  projectId: string;
  type: DetectorType;
}

export interface Detector extends Readonly<NewDetector> {
  readonly dateCreated: Date;
  readonly dateUpdated: Date;
  readonly id: string;
  readonly lastTriggered: Date;

  readonly workflowIds: string[];
}

export enum DataConditionType {
  // operators
  EQUAL = 'eq',
  GREATER_OR_EQUAL = 'gte',
  GREATER = 'gt',
  LESS_OR_EQUAL = 'lte',
  LESS = 'lt',
  NOT_EQUAL = 'ne',

  // operators
  AGE_COMPARISON = 'age_comparison',
  ASSIGNED_TO = 'assigned_to',
  EVENT_ATTRIBUTE = 'event_attribute',
  EVENT_CREATED_BY_DETECTOR = 'event_created_by_detector',
  EVENT_SEEN_COUNT = 'event_seen_count',
  EXISTING_HIGH_PRIORITY_ISSUE = 'existing_high_priority_issue',
  FIRST_SEEN_EVENT = 'first_seen_event',
  ISSUE_CATEGORY = 'issue_category',
  ISSUE_OCCURRENCES = 'issue_occurrences',
  LATEST_ADOPTED_RELEASE = 'latest_adopted_release',
  LATEST_RELEASE = 'latest_release',
  LEVEL = 'level',
  NEW_HIGH_PRIORITY_ISSUE = 'new_high_priority_issue',
  REGRESSION_EVENT = 'regression_event',
  REAPPEARED_EVENT = 'reappeared_event',
  TAGGED_EVENT = 'tagged_event',
  ISSUE_PRIORITY_EQUALS = 'issue_priority_equals',

  // frequency
  EVENT_FREQUENCY_COUNT = 'event_frequency_count',
  EVENT_FREQUENCY_PERCENT = 'event_frequency_percent',
  EVENT_UNIQUE_USER_FREQUENCY_COUNT = 'event_unique_user_frequency_count',
  EVENT_UNIQUE_USER_FREQUENCY_PERCENT = 'event_unique_user_frequency_percent',
  PERCENT_SESSIONS_COUNT = 'percent_sessions_count',
  PERCENT_SESSIONS_PERCENT = 'percent_sessions_percent',
  EVENT_UNIQUE_USER_FREQUENCY_WITH_CONDITIONS_COUNT = 'event_unique_user_frequency_with_conditions_count',
  EVENT_UNIQUE_USER_FREQUENCY_WITH_CONDITIONS_PERCENT = 'event_unique_user_frequency_with_conditions_percent',
}

export enum DataConditionGroupLogicType {
  ANY = 'any',
  ANY_SHORT_CIRCUIT = 'any-short',
  ALL = 'all',
  NONE = 'none',
}

interface DataSource {
  id: string;
  snubaQuery: {
    aggregate: string;
    dataset: string;
    id: string;
    query: string;
    timeWindow: number;
    environment?: string;
  };
  status: number;
  subscription?: string;
}

export interface DataCondition {
  comparison: any;
  comparison_type: DataConditionType;
  condition_group: DataConditionGroup;
  condition_result: any;
  id: string;
  type: DataConditionGroupLogicType;
}

export interface DataConditionGroup {
  conditions: Array<Omit<DataCondition, 'condition_group' | 'type' | 'id'>>;
  id: string;
  logicType: DataConditionGroupLogicType;
  actions?: Action[];
}

export interface Action {
  data: Record<string, unknown>;
  id: string;
  type: ActionType;
}

export enum ActionType {
  SLACK = 'slack',
  MSTEAMS = 'msteams',
  DISCORD = 'discord',
  PAGERDUTY = 'pagerduty',
  OPSGENIE = 'opsgenie',
  GITHUB = 'github',
  GITHUB_ENTERPRISE = 'github_enterprise',
  JIRA = 'jira',
  JIRA_SERVER = 'jira_server',
  AZURE_DEVOPS = 'azure_devops',
  EMAIL = 'email',
  SENTRY_APP = 'sentry_app',
  PLUGIN = 'plugin',
  WEBHOOK = 'webhook',
}
