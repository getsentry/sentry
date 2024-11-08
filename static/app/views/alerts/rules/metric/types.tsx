import {t} from 'sentry/locale';
import type {
  ActivationConditionType,
  AlertRuleActivation,
  MonitorType,
} from 'sentry/types/alerts';
import type {MEPAlertsQueryType} from 'sentry/views/alerts/wizard/options';
import type {SchemaFormConfig} from 'sentry/views/settings/organizationIntegrations/sentryAppExternalForm';

import type {Incident} from '../../types';

export enum AlertRuleThresholdType {
  ABOVE = 0,
  BELOW = 1,
  ABOVE_AND_BELOW = 2,
}

export enum AlertRuleTriggerType {
  CRITICAL = 'critical',
  WARNING = 'warning',
  RESOLVE = 'resolve',
}

export enum AlertRuleComparisonType {
  COUNT = 'count',
  CHANGE = 'change',
  PERCENT = 'percent',
  DYNAMIC = 'dynamic',
  STATIC = 'static',
}

export enum Dataset {
  /**
   * Events include errors and transactions
   */
  ERRORS = 'events',
  TRANSACTIONS = 'transactions',
  /** Also used for performance alerts **/
  GENERIC_METRICS = 'generic_metrics',
  SESSIONS = 'sessions',
  /** Also used for crash free alerts */
  METRICS = 'metrics',
  ISSUE_PLATFORM = 'search_issues',
  REPLAYS = 'replays',
  EVENTS_ANALYTICS_PLATFORM = 'events_analytics_platform',
}

export enum EventTypes {
  DEFAULT = 'default',
  ERROR = 'error',
  TRANSACTION = 'transaction',
  USER = 'user',
  SESSION = 'session',
}

export enum Datasource {
  ERROR_DEFAULT = 'error_default',
  DEFAULT = 'default',
  ERROR = 'error',
  TRANSACTION = 'transaction',
}

export enum AlertRuleSensitivity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum AlertRuleSeasonality {
  AUTO = 'auto',
}

/**
 * This is not a real aggregate as crash-free sessions/users can be only calculated on frontend by comparing the count of sessions broken down by status
 * It is here nevertheless to shoehorn sessions dataset into existing alerts codebase
 * This will most likely be revised as we introduce the metrics dataset
 */
export enum SessionsAggregate {
  CRASH_FREE_SESSIONS = 'percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate',
  CRASH_FREE_USERS = 'percentage(users_crashed, users) AS _crash_rate_alert_aggregate',
}

export type UnsavedTrigger = {
  actions: Action[];
  alertThreshold: number | '' | null;
  label: AlertRuleTriggerType;
  // UnsavedTrigger can be a part of an Unsaved Alert Rule that does not have an
  // id yet
  alertRuleId?: string;
};

export type ThresholdControlValue = {
  /**
   * Resolve threshold is optional, so it can be null
   */
  threshold: number | '' | null;
  thresholdType: AlertRuleThresholdType;
};

export type SavedTrigger = Omit<UnsavedTrigger, 'actions'> & {
  actions: Action[];
  dateCreated: string;
  id: string;
};

export type Trigger = Partial<SavedTrigger> & UnsavedTrigger;

// Form values for creating a new metric alert rule
export type UnsavedMetricRule = {
  aggregate: string;
  dataset: Dataset;
  detectionType: string;
  environment: string | null;
  projects: string[];
  query: string;
  resolveThreshold: number | '' | null;
  thresholdPeriod: number | null;
  thresholdType: AlertRuleThresholdType;
  timeWindow: TimeWindow;
  triggers: Trigger[];
  activationCondition?: ActivationConditionType;
  comparisonDelta?: number | null;
  eventTypes?: EventTypes[];
  monitorType?: MonitorType;
  monitorWindow?: number | null;
  owner?: string | null;
  queryType?: MEPAlertsQueryType | null;
  seasonality?: AlertRuleSeasonality | null;
  sensitivity?: AlertRuleSensitivity | null;
};

// Form values for updating a metric alert rule
export interface SavedMetricRule extends UnsavedMetricRule {
  activations: AlertRuleActivation[];
  dateCreated: string;
  dateModified: string;
  id: string;
  name: string;
  snooze: boolean;
  status: number;
  createdBy?: {email: string; id: number; name: string} | null;
  errors?: {detail: string}[];
  /**
   * Returned with the expand=latestIncident query parameter
   */
  latestIncident?: Incident | null;
  originalAlertRuleId?: number | null;
  snoozeCreatedBy?: string;
  snoozeForEveryone?: boolean;
}

export type MetricRule = Partial<SavedMetricRule> & UnsavedMetricRule;

export enum TimePeriod {
  SIX_HOURS = '6h',
  ONE_DAY = '1d',
  THREE_DAYS = '3d',
  // Seven days is actually 10080m but Snuba can only return up to 10000 entries, for this
  // we approximate to 9998m which prevents rounding errors due to the minutes granularity
  // limitations.
  SEVEN_DAYS = '9998m',
  FOURTEEN_DAYS = '14d',
  TWENTY_EIGHT_DAYS = '28d',
}

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

export enum ActionType {
  EMAIL = 'email',
  SLACK = 'slack',
  PAGERDUTY = 'pagerduty',
  MSTEAMS = 'msteams',
  OPSGENIE = 'opsgenie',
  DISCORD = 'discord',
  SENTRY_APP = 'sentry_app',
}

export const ActionLabel = {
  // \u200B is needed because Safari disregards autocomplete="off". It's seeing "Email" and
  // opening up the browser autocomplete for email. https://github.com/JedWatson/react-select/issues/3500
  [ActionType.EMAIL]: t('Emai\u200Bl'),
  [ActionType.SLACK]: t('Slack'),
  [ActionType.PAGERDUTY]: t('Pagerduty'),
  [ActionType.MSTEAMS]: t('MS Teams'),
  [ActionType.OPSGENIE]: t('Opsgenie'),
  [ActionType.DISCORD]: t('Discord'),
  [ActionType.SENTRY_APP]: t('Notification'),
};

export enum TargetType {
  // A direct reference, like an email address, Slack channel, or PagerDuty service
  SPECIFIC = 'specific',

  // A specific user. This could be used to grab the user's email address.
  USER = 'user',

  // A specific team. This could be used to send an email to everyone associated with a team.
  TEAM = 'team',

  // A Sentry App instead of any of the above.
  SENTRY_APP = 'sentry_app',
}

export const TargetLabel = {
  [TargetType.USER]: t('Member'),
  [TargetType.TEAM]: t('Team'),
};

export const PriorityOptions = {
  [ActionType.PAGERDUTY]: ['critical', 'warning', 'error', 'info'],
  [ActionType.OPSGENIE]: ['P1', 'P2', 'P3', 'P4', 'P5'],
};

// default priorities per threshold (0 = critical, 1 = warning)
export const DefaultPriorities = {
  [ActionType.PAGERDUTY]: {[0]: 'critical', [1]: 'warning'},
  [ActionType.OPSGENIE]: {[0]: 'P1', [1]: 'P2'},
};

/**
 * This is an available action template that is associated to a Trigger in a
 * Metric Alert Rule. They are defined by the available-actions API.
 */
export type MetricActionTemplate = {
  /**
   * See `TargetType`
   */
  allowedTargetTypes: TargetType[];

  /**
   * The integration type e.g. 'email'
   */
  type: ActionType;

  /**
   * Integration id for this `type`, should be passed to backend as `integrationId` when creating an action
   */
  integrationId?: number;

  /**
   * Name of the integration. This is a text field that differentiates integrations from the same provider from each other
   */
  integrationName?: string;

  /**
   * For some available actions, we pass in the list of available targets.
   */
  options?: Array<{label: string; value: any}>;

  /**
   * SentryApp id for this `type`, should be passed to backend as `sentryAppId` when creating an action.
   */
  sentryAppId?: number;

  sentryAppInstallationUuid?: string;
  /**
   * Name of the SentryApp. Like `integrationName`, this differentiates SentryApps from each other.
   */
  sentryAppName?: string;

  /**
   * Sentry App Alert Rule UI Component settings
   */
  settings?: SchemaFormConfig;

  /**
   * If this is a `sentry_app` action, this is the Sentry App's status.
   */
  status?: 'unpublished' | 'published' | 'internal';
};

/**
 * This is the user's configured action
 */
export type Action = UnsavedAction & Partial<SavedActionFields>;

type SavedActionFields = {
  /**
   * The id of the alert rule this action belongs to
   */
  alertRuleTriggerId: string;

  /**
   * date created
   */
  dateCreated: string;

  /**
   * A human readable description of the action generated by server
   */
  desc: string;

  /**
   * model id of the action
   */
  id: string;

  /**
   *  Could not fetch details from SentryApp. Show the rule but make it disabled.
   */
  disabled?: boolean;

  /**
   * Priority of the Opsgenie action or severity of the Pagerduty action
   */
  priority?: string;
};

type UnsavedAction = {
  /**
   * An optional Slack channel or user id the user can input to avoid rate limiting issues.
   */
  inputChannelId: string | null;
  /**
   * For some available actions, we pass in the list of available targets.
   */
  options: Array<{label: string; value: any}> | null;
  /**
   * How to identify the target. Can be email, slack channel, pagerduty service,
   * user_id, team_id, SentryApp id, etc
   */
  targetIdentifier: string | null;

  targetType: TargetType | null;

  type: ActionType;
  /** Used to maintain order of unsaved actions */
  unsavedDateCreated: string;
  unsavedId: string;

  /**
   * The id of the integration, can be null (e.g. email) or undefined (server errors when posting w/ null value)
   */
  integrationId?: number | null;

  /**
   * The id of the SentryApp, can be null (e.g. email) or undefined (server errors when posting w/ null value)
   */
  sentryAppId?: number | null;

  /**
   * If this is a `sentry_app` action, this is the Sentry App's status.
   */
  status?: 'unpublished' | 'published' | 'internal';
};
