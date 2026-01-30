import type {Actor} from 'sentry/types/core';
import type {SimpleGroup} from 'sentry/types/group';
import type {
  DataConditionGroupLogicType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';
import type {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
  Dataset,
  EventTypes,
  ExtrapolationMode,
} from 'sentry/views/alerts/rules/metric/types';
import type {Assertion, UptimeMonitorMode} from 'sentry/views/alerts/rules/uptime/types';
import type {Monitor, MonitorConfig} from 'sentry/views/insights/crons/types';
import type {
  MeasurementType as PreprodMeasurement,
  MetricType as PreprodMetric,
} from 'sentry/views/settings/project/preprod/types';

export type {PreprodMeasurement, PreprodMetric};

/**
 * See SnubaQuerySerializer
 */
export interface SnubaQuery {
  aggregate: string;
  dataset: Dataset;
  eventTypes: EventTypes[];
  id: string;
  query: string;
  /**
   * Time window in seconds
   */
  timeWindow: number;
  environment?: string;
  extrapolationMode?: ExtrapolationMode;
}

/**
 * See DataSourceSerializer
 */
interface BaseDataSource {
  id: string;
  organizationId: string;
  sourceId: string;
  type:
    | 'snuba_query_subscription'
    | 'uptime_subscription'
    | 'cron_monitor'
    | 'preprod_subscription';
}

export interface SnubaQueryDataSource extends BaseDataSource {
  /**
   * See QuerySubscriptionSerializer
   */
  queryObj: {
    id: string;
    snubaQuery: SnubaQuery;
    status: number;
    subscription: string;
  };
  type: 'snuba_query_subscription';
}

export interface UptimeSubscriptionDataSource extends BaseDataSource {
  /**
   * See UptimeSubscriptionSerializer
   */
  queryObj: {
    assertion: Assertion | null;
    body: string | null;
    headers: Array<[string, string]>;
    intervalSeconds: number;
    method: string;
    timeoutMs: number;
    traceSampling: boolean;
    url: string;
  };
  type: 'uptime_subscription';
}

export interface CronMonitorDataSource extends BaseDataSource {
  queryObj: Omit<Monitor, 'alertRule'>;
  type: 'cron_monitor';
}

export type DetectorType =
  | 'error'
  | 'metric_issue'
  | 'monitor_check_in_failure'
  | 'uptime_domain_failure'
  | 'issue_stream'
  | 'preprod_static';

/**
 * Configuration for static/threshold-based detection
 */
interface MetricDetectorConfigStatic {
  detectionType: 'static';
}

/**
 * Configuration for percentage-based change detection
 */
interface MetricDetectorConfigPercent {
  comparisonDelta: number;
  detectionType: 'percent';
}

/**
 * Configuration for dynamic/anomaly detection
 */
interface MetricDetectorConfigDynamic {
  detectionType: 'dynamic';
}

export type MetricDetectorConfig =
  | MetricDetectorConfigStatic
  | MetricDetectorConfigPercent
  | MetricDetectorConfigDynamic;

interface UptimeDetectorConfig {
  downtimeThreshold: number;
  environment: string | null;
  mode: UptimeMonitorMode;
  recoveryThreshold: number;
}

type BaseDetector = Readonly<{
  createdBy: string | null;
  dateCreated: string;
  dateUpdated: string;
  description: string | null;
  enabled: boolean;
  id: string;
  lastTriggered: string;
  latestGroup: SimpleGroup | null;
  name: string;
  owner: Actor | null;
  projectId: string;
  type: DetectorType;
  workflowIds: string[];
}>;

export interface MetricDetector extends BaseDetector {
  readonly alertRuleId: number | null;
  readonly conditionGroup: MetricConditionGroup | null;
  readonly config: MetricDetectorConfig;
  readonly dataSources: [SnubaQueryDataSource];
  readonly type: 'metric_issue';
}

export interface UptimeDetector extends BaseDetector {
  readonly config: UptimeDetectorConfig;
  readonly dataSources: [UptimeSubscriptionDataSource];
  readonly type: 'uptime_domain_failure';
}

export interface CronDetector extends BaseDetector {
  readonly dataSources: [CronMonitorDataSource];
  readonly type: 'monitor_check_in_failure';
}

export interface ErrorDetector extends BaseDetector {
  // TODO: Add error detector type fields
  readonly type: 'error';
}

export interface IssueStreamDetector extends BaseDetector {
  // TODO: Add issue stream detector type fields
  readonly type: 'issue_stream';
}

/**
 * Filter for preprod builds
 */
export interface PreprodFilter {
  key: 'build.platform' | 'build.package' | 'build.build_configuration' | 'build.branch';
  value: string;
}

/**
 * Configuration for preprod/mobile builds detection
 */
interface PreprodDetectorConfig {
  environment: string | null;
  measurement: PreprodMeasurement;
  metric: PreprodMetric;
}

export interface PreprodDataSource extends BaseDataSource {
  queryObj: {
    filters: PreprodFilter[];
    sourceId: string;
  };
  type: 'preprod_subscription';
}

export interface PreprodDetector extends BaseDetector {
  readonly conditionGroup: MetricConditionGroup | null;
  readonly config: PreprodDetectorConfig;
  readonly dataSources: [PreprodDataSource];
  readonly type: 'preprod_static';
}

export type Detector =
  | MetricDetector
  | UptimeDetector
  | CronDetector
  | ErrorDetector
  | IssueStreamDetector
  | PreprodDetector;

interface UpdateConditionGroupPayload {
  conditions: Array<Omit<MetricCondition, 'id'>>;
  logicType: MetricConditionGroup['logicType'];
}

interface UpdateSnubaDataSourcePayload {
  aggregate: string;
  dataset: string;
  environment: string | null;
  eventTypes: string[];
  query: string;
  queryType: number;
  timeWindow: number;
  extrapolationMode?: string;
}

interface UpdateUptimeDataSourcePayload {
  intervalSeconds: number;
  method: string;
  timeoutMs: number;
  traceSampling: boolean;
  url: string;
  assertion?: Assertion | null;
  body?: string | null;
  headers?: Array<[string, string]>;
}

export interface BaseDetectorUpdatePayload {
  name: string;
  owner: string | null;
  projectId: Detector['projectId'];
  type: Detector['type'];
  workflowIds: string[];
  description?: string | null;
  enabled?: boolean;
}

export interface UptimeDetectorUpdatePayload extends BaseDetectorUpdatePayload {
  config: UptimeDetectorConfig;
  dataSources: UpdateUptimeDataSourcePayload[];
  type: 'uptime_domain_failure';
}

export interface MetricDetectorUpdatePayload extends BaseDetectorUpdatePayload {
  conditionGroup: UpdateConditionGroupPayload;
  config: MetricDetectorConfig;
  dataSources: UpdateSnubaDataSourcePayload[];
  type: 'metric_issue';
}

export interface CronDetectorUpdatePayload extends BaseDetectorUpdatePayload {
  dataSources: Array<{
    config: MonitorConfig;
    name: string;
  }>;
  type: 'monitor_check_in_failure';
}

interface UpdatePreprodDataSourcePayload {
  filters: PreprodFilter[];
  sourceId: string;
}

export interface PreprodDetectorUpdatePayload extends BaseDetectorUpdatePayload {
  conditionGroup: UpdateConditionGroupPayload;
  config: {
    environment: string | null;
    measurement: PreprodMeasurement;
    metric: PreprodMetric;
  };
  dataSources: UpdatePreprodDataSourcePayload[];
  type: 'preprod_static';
}

export interface MetricConditionGroup {
  conditions: MetricCondition[];
  id: string;
  logicType: DataConditionGroupLogicType;
}

export interface MetricCondition {
  comparison: MetricDataCondition;
  id: string;
  type: DataConditionType;
  conditionResult?: any;
}

/**
 * See AnomalyDetectionHandler
 */
export interface AnomalyDetectionComparison {
  seasonality:
    | 'auto'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'hourly_daily'
    | 'hourly_weekly'
    | 'hourly_daily_weekly'
    | 'daily_weekly';
  sensitivity: AlertRuleSensitivity;
  thresholdType: AlertRuleThresholdType;
}

type MetricDataCondition = AnomalyDetectionComparison | number;
