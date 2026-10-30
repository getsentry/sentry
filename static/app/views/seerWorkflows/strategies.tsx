import {t} from 'sentry/locale';
import type {WorkflowStrategy} from 'sentry/views/seerWorkflows/types';

type StrategyMeta = {
  label: string;
  description?: string;
};

export const STRATEGY_META: Record<WorkflowStrategy, StrategyMeta> = {
  agentic_triage: {
    label: t('Agentic triage'),
    description: t('Automatically triage and fix the most fixable Issues.'),
  },
  agentic_triage_v2: {
    label: t('Agentic triage'),
    description: t('Automatically triage and fix the most fixable Issues.'),
  },
  breached_metrics: {
    label: t('Breached metrics'),
    description: t(
      'Monitors backend metrics and investigates why certain key metrics were breached.'
    ),
  },
  duplicate_monitors: {
    label: t('Duplicate monitors'),
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
