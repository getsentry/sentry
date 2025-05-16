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
  config: Record<string, unknown>;
  dataCondition: DataConditionGroup;
  dataSource: DataSource;
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
