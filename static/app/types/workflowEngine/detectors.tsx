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
    urlDomain: string;
    urlDomainSuffix: string;
  };
  type: 'uptime_subscription';
}

/**
 * See DataSourceSerializer
 */
export type DataSource = SnubaQueryDataSource | UptimeSubscriptionDataSource;

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

export type DetectorConfig = MetricDetectorConfig | UptimeDetectorConfig;

interface NewDetector {
  conditionGroup: DataConditionGroup | null;
  config: DetectorConfig;
  dataSources: DataSource[] | null;
  disabled: boolean;
  name: string;
  projectId: string;
  type: DetectorType;
  workflowIds: string[];
}

export interface Detector extends Readonly<NewDetector> {
  readonly createdBy: string | null;
  readonly dateCreated: string;
  readonly dateUpdated: string;
  readonly id: string;
  readonly lastTriggered: string;
  readonly owner: string | null;
}

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
}

export interface UptimeDetectorUpdatePayload extends BaseDetectorUpdatePayload {
  dataSource: UpdateUptimeDataSourcePayload;
  type: 'uptime_domain_failure';
}

export interface MetricDetectorUpdatePayload extends BaseDetectorUpdatePayload {
  conditionGroup: UpdateConditionGroupPayload;
  config: DetectorConfig;
  dataSource: UpdateSnubaDataSourcePayload;
  type: 'metric_issue';
}
