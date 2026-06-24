import {t} from 'sentry/locale';
import {ActionType, type Action} from 'sentry/types/workflowEngine/actions';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import type {Detector} from 'sentry/types/workflowEngine/detectors';

const METRIC_DETECTOR_SUPPORTED_ACTIONS = new Set<ActionType>([
  ActionType.EMAIL,
  ActionType.SLACK,
  ActionType.SLACK_STAGING,
  ActionType.MSTEAMS,
  ActionType.PAGERDUTY,
  ActionType.OPSGENIE,
  ActionType.DISCORD,
  ActionType.SENTRY_APP,
]);

const ACTIVITY_TRIGGER_SUPPORTED_ACTIONS = new Set<ActionType>([
  ActionType.EMAIL,
  ActionType.SLACK,
  ActionType.SLACK_STAGING,
  ActionType.MSTEAMS,
  ActionType.DISCORD,
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
    !ACTIVITY_TRIGGER_SUPPORTED_ACTIONS.has(action.type) &&
    triggerConditions.some(c => c.type === DataConditionType.SEER_ACTIVITY_TRIGGER)
  ) {
    warnings.push(t('This action is not supported for Seer activity triggers.'));
  }

  if (
    !METRIC_DETECTOR_SUPPORTED_ACTIONS.has(action.type) &&
    connectedDetectors.some(detector => detector.type === 'metric_issue')
  ) {
    warnings.push(t('This action will not fire for metric issues.'));
  }

  return warnings;
}
