import {t} from 'sentry/locale';
import {
  MonitorCleanupRunResults,
  getMonitorRunSummary,
} from 'sentry/views/seerWorkflows/monitorCleanup';
import {
  NightShiftDebug,
  NightShiftResults,
  getNightShiftSummary,
} from 'sentry/views/seerWorkflows/nightShift';
import type {
  StrategyCategory,
  StrategyVisibility,
  WorkflowStrategy,
  WorkflowRow,
} from 'sentry/views/seerWorkflows/types';

type StrategyMeta = {
  Results: React.ComponentType<{organizationSlug: string; row: WorkflowRow}>;
  category: StrategyCategory;
  getSummary: (row: WorkflowRow) => string;
  label: string;
  visibility: StrategyVisibility;
  Debug?: React.ComponentType<{row: WorkflowRow}>;
  runAction?: {feature: string; label: string};
};

export const STRATEGY_META: Record<WorkflowStrategy, StrategyMeta> = {
  duplicate_monitors: {
    Results: MonitorCleanupRunResults,
    getSummary: getMonitorRunSummary,
    runAction: {
      feature: 'seer-workflows-monitor-cleanup',
      label: t('Monitor scan'),
    },
    label: 'Duplicate monitors',
    visibility: 'configurable',
    category: 'reliability',
  },
  agentic_triage: {
    Results: NightShiftResults,
    getSummary: getNightShiftSummary,
    Debug: NightShiftDebug,
    label: 'Agentic triage',
    visibility: 'configurable',
    category: 'issues',
  },
};

export const CATEGORY_LABELS: Record<StrategyCategory, string> = {
  issues: 'Issues',
  reliability: 'Reliability',
  user_experience: 'User experience',
};

export const CATEGORY_ORDER: StrategyCategory[] = [
  'issues',
  'reliability',
  'user_experience',
];

export function getWorkflowRunActions(features: string[]) {
  return (Object.keys(STRATEGY_META) as WorkflowStrategy[]).flatMap(strategy => {
    const action = STRATEGY_META[strategy].runAction;
    return action && features.includes(action.feature)
      ? [{strategy, label: action.label}]
      : [];
  });
}
