import {PriorityLevel} from 'sentry/types/group';
import type {
  Attribute,
  MatchType,
} from 'sentry/views/automations/components/actionFilters/constants';

import type {Action} from './actions';

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
  ISSUE_RESOLVED_TRIGGER = 'issue_resolved_trigger',
  TAGGED_EVENT = 'tagged_event',
  ISSUE_PRIORITY_EQUALS = 'issue_priority_equals',
  ISSUE_PRIORITY_GREATER_OR_EQUAL = 'issue_priority_greater_or_equal',
  ISSUE_PRIORITY_DEESCALATING = 'issue_priority_deescalating',

  // frequency
  EVENT_FREQUENCY_COUNT = 'event_frequency_count',
  EVENT_FREQUENCY_PERCENT = 'event_frequency_percent',
  EVENT_UNIQUE_USER_FREQUENCY_COUNT = 'event_unique_user_frequency_count',
  EVENT_UNIQUE_USER_FREQUENCY_PERCENT = 'event_unique_user_frequency_percent',
  PERCENT_SESSIONS_COUNT = 'percent_sessions_count',
  PERCENT_SESSIONS_PERCENT = 'percent_sessions_percent',
  EVENT_UNIQUE_USER_FREQUENCY_WITH_CONDITIONS_COUNT = 'event_unique_user_frequency_with_conditions_count',
  EVENT_UNIQUE_USER_FREQUENCY_WITH_CONDITIONS_PERCENT = 'event_unique_user_frequency_with_conditions_percent',

  // frequency types for UI only
  EVENT_FREQUENCY = 'event_frequency',
  EVENT_UNIQUE_USER_FREQUENCY = 'event_unique_user_frequency',
  PERCENT_SESSIONS = 'percent_sessions',
  ANOMALY_DETECTION = 'anomaly_detection',
}

export enum DataConditionGroupLogicType {
  ANY = 'any',
  ANY_SHORT_CIRCUIT = 'any-short',
  ALL = 'all',
  NONE = 'none',
}

export enum DetectorPriorityLevel {
  OK = 0,
  LOW = 25,
  MEDIUM = 50,
  HIGH = 75,
}

export const DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL: Record<
  Exclude<DetectorPriorityLevel, DetectorPriorityLevel.OK>,
  PriorityLevel
> = {
  [DetectorPriorityLevel.LOW]: PriorityLevel.LOW,
  [DetectorPriorityLevel.MEDIUM]: PriorityLevel.MEDIUM,
  [DetectorPriorityLevel.HIGH]: PriorityLevel.HIGH,
};

/**
 * See DataConditionSerializer
 */
export interface DataCondition {
  comparison: any;
  id: string;
  type: DataConditionType;
  conditionResult?: any;
}

export interface DataConditionGroup {
  conditions: DataCondition[];
  id: string;
  logicType: DataConditionGroupLogicType;
  actions?: Action[];
}

export enum DataConditionHandlerGroupType {
  DETECTOR_TRIGGER = 'detector_trigger',
  WORKFLOW_TRIGGER = 'workflow_trigger',
  ACTION_FILTER = 'action_filter',
}

export enum DataConditionHandlerSubgroupType {
  ISSUE_ATTRIBUTES = 'issue_attributes',
  FREQUENCY = 'frequency',
  EVENT_ATTRIBUTES = 'event_attributes',
}

export interface DataConditionHandler {
  comparisonJsonSchema: Record<string, any>;
  handlerGroup: DataConditionHandlerGroupType;
  type: DataConditionType;
  handlerSubgroup?: DataConditionHandlerSubgroupType;
}

interface BaseSubfilter {
  id: string;
  match: MatchType;
  value: string;
}

export interface AttributeSubfilter extends BaseSubfilter {
  attribute: Attribute;
  key: never;
}

export interface TagSubfilter extends BaseSubfilter {
  attribute: never;
  key: string;
}

export type Subfilter = AttributeSubfilter | TagSubfilter | BaseSubfilter;
