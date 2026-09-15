import {t} from 'sentry/locale';
import {
  AgenticTriageDebug,
  AgenticTriageResults,
  getAgenticTriageSummary,
} from 'sentry/views/seerWorkflows/agenticTriage';
import {
  MonitorCleanupRunResults,
  getMonitorRunSummary,
} from 'sentry/views/seerWorkflows/monitorCleanup';
import type {WorkflowStrategy, WorkflowRow} from 'sentry/views/seerWorkflows/types';

type StrategyMeta = {
  Results: React.ComponentType<{organizationSlug: string; row: WorkflowRow}>;
  getSummary: (row: WorkflowRow) => string;
  label: string;
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
  },
  agentic_triage: {
    Results: AgenticTriageResults,
    getSummary: getAgenticTriageSummary,
    Debug: AgenticTriageDebug,
    label: 'Agentic triage',
  },
};

export function getWorkflowRunActions(features: string[]) {
  return (Object.keys(STRATEGY_META) as WorkflowStrategy[]).flatMap(strategy => {
    const action = STRATEGY_META[strategy].runAction;
    return action && features.includes(action.feature)
      ? [{strategy, label: action.label}]
      : [];
  });
}
