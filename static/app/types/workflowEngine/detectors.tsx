import type {DataConditionGroup} from 'sentry/types/workflowEngine/dataConditions';

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

interface QueryObject {
  id: string;
  snubaQuery: SnubaQuery;
  status: number;
  subscription: string;
}

export interface SnubaQueryDataSource {
  id: string;
  organizationId: string;
  queryObj: QueryObject;
  sourceId: string;
  type: 'snuba_query_subscription';
}

export type DataSource = SnubaQueryDataSource;

export type DetectorType =
  | 'crons'
  | 'errors'
  | 'metric'
  | 'performance'
  | 'replay'
  | 'trace'
  | 'uptime';

interface NewDetector {
  conditionGroup: DataConditionGroup;
  config: Record<string, unknown>;
  dataSources: DataSource[];
  disabled: boolean;
  name: string;
  projectId: string;
  type: DetectorType;
  workflowIds: string[];
}

export interface Detector extends Readonly<NewDetector> {
  readonly createdBy: string;
  readonly dateCreated: string;
  readonly dateUpdated: string;
  readonly id: string;
  readonly lastTriggered: string;
}
