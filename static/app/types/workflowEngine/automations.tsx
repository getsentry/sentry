import type {DataConditionGroup} from 'sentry/types/workflowEngine/dataConditions';

interface NewAutomation {
  actionFilters: DataConditionGroup[];
  config: {frequency?: number};
  detectorIds: string[];
  environment: string;
  name: string;
  triggers: DataConditionGroup;
  disabled?: boolean;
}

export interface Automation extends Readonly<NewAutomation> {
  readonly dateCreated: string;
  readonly dateUpdated: string;
  readonly id: string;
  readonly lastTriggered: string;
}
