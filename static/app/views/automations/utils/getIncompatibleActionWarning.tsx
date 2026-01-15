import {t} from 'sentry/locale';
import {ActionType, type Action} from 'sentry/types/workflowEngine/actions';
import type {Detector} from 'sentry/types/workflowEngine/detectors';

const METRIC_DETECTOR_SUPPORTED_ACTIONS = new Set<ActionType>([
  ActionType.EMAIL,
  ActionType.SLACK,
  ActionType.MSTEAMS,
  ActionType.PAGERDUTY,
  ActionType.OPSGENIE,
  ActionType.DISCORD,
  ActionType.SENTRY_APP,
]);

/**
 * Metric detectors only support a subset of actions, so we need
 * to display a warning if the action is not supported.
 */
export function getIncompatibleActionWarning(
  action: Action,
  {connectedDetectors}: {connectedDetectors: Detector[]}
): string | null {
  if (METRIC_DETECTOR_SUPPORTED_ACTIONS.has(action.type)) {
    return null;
  }

  if (!connectedDetectors.some(detector => detector.type === 'metric_issue')) {
    return null;
  }

  return t('This action will not fire for metric issues.');
}
