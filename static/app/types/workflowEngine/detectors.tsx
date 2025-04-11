import type {
  DataConditionGroup,
  DataSource,
} from 'sentry/types/workflowEngine/dataConditions';

export type DetectorType = 'metric' | 'crons' | 'uptime';

export interface NewDetector {
  config: Record<string, unknown>;
  dataCondition: DataConditionGroup;
  dataSource: DataSource;
  disabled: boolean;
  name: string;
  projectId: string;
  type: DetectorType;
}

export interface Detector extends Readonly<NewDetector> {
  readonly dateCreated: Date;
  readonly dateUpdated: Date;
  readonly id: string;
  readonly lastTriggered: Date;

  readonly workflowIds: string[];
}
