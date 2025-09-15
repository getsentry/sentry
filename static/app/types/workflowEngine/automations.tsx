import type {Group} from 'sentry/types/group';
import type {DataConditionGroup} from 'sentry/types/workflowEngine/dataConditions';
import type {Detector} from 'sentry/types/workflowEngine/detectors';

export interface NewAutomation {
  actionFilters: DataConditionGroup[];
  config: {frequency?: number};
  detectorIds: string[];
  enabled: boolean;
  environment: string | null;
  name: string;
  triggers: DataConditionGroup | null;
}

export interface Automation extends Readonly<NewAutomation> {
  readonly createdBy: string;
  readonly dateCreated: string;
  readonly dateUpdated: string;
  readonly id: string;
  readonly lastTriggered: string;
}

export interface AutomationFireHistory {
  count: number;
  eventId: string;
  group: Group;
  lastTriggered: string;
  detector?: Detector;
}

export type AutomationStats = {
  count: number;
  date: string;
};

/**
 * Warning information about the status of actions in an automation.
 */
export type StatusWarning = {
  color: 'danger' | 'warning';
  message: string;
};
