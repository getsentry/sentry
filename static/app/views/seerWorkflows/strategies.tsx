import {IconLab} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  MonitorCleanupRunResults,
  MonitorCleanupSummary,
} from 'sentry/views/seerWorkflows/monitorCleanup';
import {
  getNightShiftRow,
  NightShiftDebug,
  NightShiftResults,
  NightShiftSummary,
} from 'sentry/views/seerWorkflows/nightShift';
import type {
  Frequency,
  OutputId,
  StrategyCategory,
  StrategyVisibility,
  WorkflowStrategy,
  SeerWorkflowRun,
  WorkflowRow,
} from 'sentry/views/seerWorkflows/types';

type StrategyMeta = {
  Icon: React.ComponentType<{size?: 'xs' | 'sm' | 'md'}>;
  Results: React.ComponentType<{organizationSlug: string; row: WorkflowRow}>;
  Summary: React.ComponentType<{row: WorkflowRow}>;
  category: StrategyCategory;
  frequencies: Frequency[];
  label: string;
  outputs: OutputId[];
  summary: string;
  visibility: StrategyVisibility;
  Debug?: React.ComponentType<{row: WorkflowRow}>;
  getRowDetails?: (run: SeerWorkflowRun) => Partial<WorkflowRow>;
  runAction?: {feature: string; label: string};
};

export const STRATEGY_META: Record<WorkflowStrategy, StrategyMeta> = {
  duplicate_monitors: {
    Results: MonitorCleanupRunResults,
    Summary: MonitorCleanupSummary,
    runAction: {
      feature: 'seer-workflows-monitor-cleanup',
      label: t('Monitor scan'),
    },
    label: 'Duplicate monitors',
    summary: 'Finds possible duplicate metric monitors for review.',
    Icon: IconLab,
    frequencies: [],
    visibility: 'configurable',
    category: 'reliability',
    outputs: ['monitor_annotation'],
  },
  agentic_triage: {
    Results: NightShiftResults,
    Summary: NightShiftSummary,
    Debug: NightShiftDebug,
    getRowDetails: getNightShiftRow,
    label: 'Agentic triage',
    summary:
      'Investigates new issues nightly and recommends autofix or assignment for each.',
    Icon: IconLab,
    frequencies: ['daily', 'weekly'],
    visibility: 'configurable',
    category: 'issues',
    outputs: ['autofix_runs', 'issue_activity'],
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
