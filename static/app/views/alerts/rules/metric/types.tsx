import {t} from 'sentry/locale';
import {
  ActionType,
  AlertRuleSeasonality,
  AlertRuleSensitivity,
  AlertRuleThresholdType,
  Dataset,
  EventTypes,
  ExtrapolationMode,
  TargetType,
  TimeWindow,
} from 'sentry/views/alerts/rules/metric/typesBase';
import type {Trigger} from 'sentry/views/alerts/rules/metric/typesBase';
import type {Incident} from 'sentry/views/alerts/types';
import type {MEPAlertsQueryType} from 'sentry/views/alerts/wizard/options';
import type {SchemaFormConfig} from 'sentry/views/settings/organizationIntegrations/sentryAppExternalForm';

export const EAP_EXTRAPOLATION_MODE_MAP = {
  [ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED]: 'sampleWeighted',
  [ExtrapolationMode.SERVER_WEIGHTED]: 'serverOnly',
  [ExtrapolationMode.NONE]: 'none',
  [ExtrapolationMode.UNKNOWN]: 'sampleWeighted',
};

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
  comparisonDelta?: number | null;
  eventTypes?: EventTypes[];
  monitorWindow?: number | null;
  owner?: string | null;
  queryType?: MEPAlertsQueryType | null;
  seasonality?: AlertRuleSeasonality | null;
  sensitivity?: AlertRuleSensitivity | null;
};

// Form values for updating a metric alert rule
export interface SavedMetricRule extends UnsavedMetricRule {
  dateCreated: string;
  dateModified: string;
  id: string;
  name: string;
  snooze: boolean;
  status: number;
  createdBy?: {email: string; id: number; name: string} | null;
  errors?: Array<{detail: string}>;
  extrapolationMode?: ExtrapolationMode;
  /**
   * Returned with the expand=latestIncident query parameter
   */
  latestIncident?: Incident | null;
  originalAlertRuleId?: number | null;
  snoozeCreatedBy?: string;
  snoozeForEveryone?: boolean;
}

export type MetricRule = Partial<SavedMetricRule> & UnsavedMetricRule;

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
