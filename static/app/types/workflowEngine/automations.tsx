import type {DataConditionGroup} from 'sentry/types/workflowEngine/dataConditions';

export interface NewAutomation {
  actionFilters: DataConditionGroup[];
  config: {frequency?: number};
  detectorIds: string[];
  environment: string | null;
  name: string;
  triggers: DataConditionGroup | null;
  disabled?: boolean;
}

export interface Automation extends Readonly<NewAutomation> {
  readonly createdBy: string;
  readonly dateCreated: string;
  readonly dateUpdated: string;
  readonly id: string;
  readonly lastTriggered: string;
}
