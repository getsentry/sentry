import type {
  DataConditionGroup,
  DataSource,
} from 'sentry/types/workflowEngine/dataConditions';

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
  readonly connectedWorkflows: string[];
  readonly createdBy: string;
  readonly dateCreated: string;
  readonly dateUpdated: string;
  readonly id: string;
  readonly lastTriggered: string;
}
