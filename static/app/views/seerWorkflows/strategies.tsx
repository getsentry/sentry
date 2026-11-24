import {t} from 'sentry/locale';

import type {WorkflowStrategy} from './types';

type StrategyMeta = {label: string; description?: string};

export const STRATEGY_META: Record<WorkflowStrategy, StrategyMeta> = {
  agentic_triage: {
    label: t('Agentic Triage'),
    description: t('Automatically triage and fix the most fixable Issues.'),
  },
  breached_metric_investigation: {
    label: t('Breached Metrics'),
    description: t(
      'Monitors backend metrics and investigates why certain key metrics were breached.'
    ),
  },
  duplicate_monitors: {label: t('Duplicate Monitors')},
  scheduled_investigation: {
    label: t('Scheduled Investigation'),
    description: t('Investigates issues in the selected projects on a schedule.'),
  },
};

/**
 * Falls back to the raw strategy for strategies the frontend doesn't know yet
 */
export function getStrategyLabel(strategy: string): string {
  return Object.hasOwn(STRATEGY_META, strategy)
    ? STRATEGY_META[strategy as WorkflowStrategy].label
    : strategy;
}
