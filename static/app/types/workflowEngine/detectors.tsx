import type {DataConditionGroup} from 'sentry/types/workflowEngine/dataConditions';

/**
 * See SnubaQuerySerializer
 */
interface SnubaQuery {
  aggregate: string;
  dataset: string;
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
  };
  type: 'snuba_query_subscription';
}

export interface UptimeSubscriptionDataSource extends BaseDataSource {
  /**
   * See UptimeSubscriptionSerializer
   */
  queryObj: {
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
  | 'crons'
  | 'error'
  | 'metric'
  | 'performance'
  | 'replay'
  | 'trace'
  | 'uptime';

interface NewDetector {
  conditionGroup: DataConditionGroup | null;
  config: Record<string, unknown>;
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
