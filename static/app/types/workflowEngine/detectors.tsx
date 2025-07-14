import type {
  DataCondition,
  DataConditionGroup,
} from 'sentry/types/workflowEngine/dataConditions';
import type {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
  Dataset,
  EventTypes,
} from 'sentry/views/alerts/rules/metric/types';

/**
 * See SnubaQuerySerializer
 */
interface SnubaQuery {
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
}

/**
 * See DataSourceSerializer
 */
interface BaseDataSource {
  id: string;
  organizationId: string;
  sourceId: string;
  type: 'snuba_query_subscription' | 'uptime_subscription';
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
  } | null;
  type: 'snuba_query_subscription';
}

interface UptimeSubscriptionDataSource extends BaseDataSource {
  /**
   * See UptimeSubscriptionSerializer
   */
  queryObj: {
    body: string | null;
    headers: Array<[string, string]>;
    hostProviderId: string;
    hostProviderName: string;
    intervalSeconds: number;
    method: string;
    timeoutMs: number;
    traceSampling: boolean;
    url: string;
  };
  type: 'uptime_subscription';
}

export type DetectorType =
  | 'error'
  | 'metric_issue'
  | 'uptime_subscription'
  | 'uptime_domain_failure';

interface BaseMetricDetectorConfig {
  thresholdPeriod: number;
}

/**
 * Configuration for static/threshold-based detection
 */
interface MetricDetectorConfigStatic extends BaseMetricDetectorConfig {
  detectionType: 'static';
}

/**
 * Configuration for percentage-based change detection
 */
interface MetricDetectorConfigPercent extends BaseMetricDetectorConfig {
  comparisonDelta: number;
  detectionType: 'percent';
}

/**
 * Configuration for dynamic/anomaly detection
 */
interface MetricDetectorConfigDynamic extends BaseMetricDetectorConfig {
  detectionType: 'dynamic';
  seasonality?: 'auto' | 'daily' | 'weekly' | 'monthly';
  sensitivity?: AlertRuleSensitivity;
  thresholdType?: AlertRuleThresholdType;
}

export type MetricDetectorConfig =
  | MetricDetectorConfigStatic
  | MetricDetectorConfigPercent
  | MetricDetectorConfigDynamic;

interface UptimeDetectorConfig {
  environment: string;
}

type BaseDetector = Readonly<{
  createdBy: string | null;
  dateCreated: string;
  dateUpdated: string;
  disabled: boolean;
  id: string;
  lastTriggered: string;
  name: string;
  owner: string | null;
  projectId: string;
  type: DetectorType;
  workflowIds: string[];
}>;

export interface MetricDetector extends BaseDetector {
  readonly conditionGroup: DataConditionGroup | null;
  readonly config: MetricDetectorConfig;
  readonly dataSources: SnubaQueryDataSource[];
  readonly type: 'metric_issue';
}

export interface UptimeDetector extends BaseDetector {
  readonly config: UptimeDetectorConfig;
  readonly dataSources: UptimeSubscriptionDataSource[];
  readonly type: 'uptime_domain_failure';
}

interface CronDetector extends BaseDetector {
  // TODO: Add cron detector type fields
  readonly type: 'uptime_subscription';
}

export interface ErrorDetector extends BaseDetector {
  // TODO: Add error detector type fields
  readonly type: 'error';
}

export type Detector = MetricDetector | UptimeDetector | CronDetector | ErrorDetector;

interface UpdateConditionGroupPayload {
  conditions: Array<Omit<DataCondition, 'id'>>;
  logicType: DataConditionGroup['logicType'];
}

interface UpdateSnubaDataSourcePayload {
  aggregate: string;
  dataset: string;
  environment: string | null;
  eventTypes: string[];
  query: string;
  queryType: number;
  timeWindow: number;
}

interface UpdateUptimeDataSourcePayload {
  intervalSeconds: number;
  method: string;
  timeoutMs: number;
  traceSampling: boolean;
  url: string;
}

export interface BaseDetectorUpdatePayload {
  name: string;
  owner: Detector['owner'];
  projectId: Detector['projectId'];
  workflowIds: string[];
}

export interface UptimeDetectorUpdatePayload extends BaseDetectorUpdatePayload {
  dataSource: UpdateUptimeDataSourcePayload;
  type: 'uptime_domain_failure';
}

export interface MetricDetectorUpdatePayload extends BaseDetectorUpdatePayload {
  conditionGroup: UpdateConditionGroupPayload;
  config: MetricDetectorConfig;
  dataSource: UpdateSnubaDataSourcePayload;
  type: 'metric_issue';
}
