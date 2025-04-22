import type {Action} from './actions';

interface SnubaQuery {
  aggregate: string;
  dataset: string;
  id: string;
  query: string;
  timeWindow: number;
  environment?: string;
}

export interface DataSource {
  id: string;
  snubaQuery: SnubaQuery;
  status: number;
  subscription?: string;
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
  ISSUE_PRIORITY_GREATER_OR_EQUAL = 'issue_priority_greater_or_equal',

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

export interface NewDataCondition {
  comparison: any;
  comparison_type: DataConditionType;
  condition_group?: DataConditionGroup;
  condition_result?: any;
}

export interface DataCondition extends Readonly<NewDataCondition> {
  readonly id: string;
  type: DataConditionGroupLogicType;
}

export interface DataConditionGroup {
  conditions: NewDataCondition[];
  id: string;
  logicType: DataConditionGroupLogicType;
  actions?: Action[];
}
