import {t} from 'sentry/locale';
import {ActionType, type Action} from 'sentry/types/workflowEngine/actions';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import type {Detector} from 'sentry/types/workflowEngine/detectors';

// Ticketing actions deliver via the issue-alert (create-a-ticket) path, which is
// not wired up for metric issues. Every other action type fires for metric issues.
const METRIC_DETECTOR_UNSUPPORTED_ACTIONS = new Set<ActionType>([
  ActionType.GITHUB,
  ActionType.GITHUB_ENTERPRISE,
  ActionType.JIRA,
  ActionType.JIRA_SERVER,
  ActionType.AZURE_DEVOPS,
]);

const SEER_ACTIVITY_SUPPORTED_ACTIONS = new Set<ActionType>([
  ActionType.EMAIL,
  ActionType.SLACK,
  ActionType.SLACK_STAGING,
  ActionType.MSTEAMS,
  ActionType.DISCORD,
  ActionType.SENTRY_APP,
  ActionType.WEBHOOK,
]);

interface IncompatibleActionWarningContext {
  connectedDetectors: Detector[];
  triggerConditions: DataCondition[];
}

/**
 * Returns all applicable warning messages for an action that is
 * incompatible with the current trigger or detector configuration.
 */
export function getIncompatibleActionWarnings(
  action: Action,
  {connectedDetectors, triggerConditions}: IncompatibleActionWarningContext
): string[] {
  const warnings: string[] = [];

  if (
    !SEER_ACTIVITY_SUPPORTED_ACTIONS.has(action.type) &&
    triggerConditions.some(c => c.type === DataConditionType.SEER_ACTIVITY_TRIGGER)
  ) {
    warnings.push(t('This action is not supported for Seer activity triggers.'));
  }

  if (
    METRIC_DETECTOR_UNSUPPORTED_ACTIONS.has(action.type) &&
    connectedDetectors.some(detector => detector.type === 'metric_issue')
  ) {
    warnings.push(t('This action will not fire for metric issues.'));
  }

  return warnings;
}
