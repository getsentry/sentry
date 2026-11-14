import {t} from 'sentry/locale';
import {ActionType, type Action} from 'sentry/types/workflowEngine/actions';
import type {DataConditionGroup} from 'sentry/types/workflowEngine/dataConditions';
import {
  DataConditionGroupLogicType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';
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

const ACTIVITY_TRIGGER_SUPPORTED_ACTIONS = new Set<ActionType>([
  ActionType.EMAIL,
  ActionType.SLACK,
  ActionType.SLACK_STAGING,
  ActionType.MSTEAMS,
  ActionType.DISCORD,
  ActionType.SENTRY_APP,
  ActionType.WEBHOOK,
]);

const ACTIVITY_TRIGGERS = new Set<DataConditionType>([
  DataConditionType.SEER_ACTIVITY_TRIGGER,
  DataConditionType.ISSUE_RESOLVED_TRIGGER,
]);

interface IncompatibleActionWarningContext {
  connectedDetectors: Detector[];
  triggers: DataConditionGroup;
}

function hasTrigger(triggers: DataConditionGroup, type: DataConditionType): boolean {
  return triggers.conditions.some(condition => condition.type === type);
}

function canFireFromEventTrigger(triggers: DataConditionGroup): boolean {
  return (
    triggers.logicType !== DataConditionGroupLogicType.ALL &&
    triggers.conditions.some(condition => !ACTIVITY_TRIGGERS.has(condition.type))
  );
}

/**
 * Returns all applicable warning messages for an action that is
 * incompatible with the current trigger or detector configuration.
 */
export function getIncompatibleActionWarnings(
  action: Action,
  {connectedDetectors, triggers}: IncompatibleActionWarningContext
): string[] {
  const warnings: string[] = [];

  if (
    !ACTIVITY_TRIGGER_SUPPORTED_ACTIONS.has(action.type) &&
    hasTrigger(triggers, DataConditionType.SEER_ACTIVITY_TRIGGER)
  ) {
    warnings.push(t('This action is not supported for Seer activity triggers.'));
  }

  if (
    !ACTIVITY_TRIGGER_SUPPORTED_ACTIONS.has(action.type) &&
    hasTrigger(triggers, DataConditionType.ISSUE_RESOLVED_TRIGGER) &&
    !canFireFromEventTrigger(triggers)
  ) {
    warnings.push(t('This action will not fire when an issue is resolved.'));
  }

  if (
    METRIC_DETECTOR_UNSUPPORTED_ACTIONS.has(action.type) &&
    connectedDetectors.some(detector => detector.type === 'metric_issue')
  ) {
    warnings.push(t('This action will not fire for metric issues.'));
  }

  return warnings;
}

export function getPartialTriggerSupportMessage(
  action: Action,
  triggers: DataConditionGroup
): string | null {
  if (
    ACTIVITY_TRIGGER_SUPPORTED_ACTIONS.has(action.type) ||
    !hasTrigger(triggers, DataConditionType.ISSUE_RESOLVED_TRIGGER) ||
    hasTrigger(triggers, DataConditionType.SEER_ACTIVITY_TRIGGER) ||
    !canFireFromEventTrigger(triggers)
  ) {
    return null;
  }

  return t(
    'This action will fire for your other triggers, but not when an issue is resolved.'
  );
}
