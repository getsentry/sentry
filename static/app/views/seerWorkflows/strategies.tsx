import {t} from 'sentry/locale';
import {
  AgenticTriageResults,
  getAgenticTriageStatus,
  getAgenticTriageSummary,
} from 'sentry/views/seerWorkflows/agenticTriage';
import {
  MonitorCleanupRunResults,
  getMonitorRunSummary,
} from 'sentry/views/seerWorkflows/monitorCleanup';
import type {
  SeerWorkflowRun,
  WorkflowStrategy,
  WorkflowDisplayStatus,
} from 'sentry/views/seerWorkflows/types';

type StrategyMeta = {
  label: string;
  description?: string;
  runAction?: {feature: string; label: string};
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
    runAction: {
      feature: 'seer-workflows-monitor-cleanup',
      label: t('Monitor scan'),
    },
  },
};

export function getWorkflowStatus(run: SeerWorkflowRun): WorkflowDisplayStatus {
  switch (run.strategy) {
    case 'agentic_triage':
    case 'agentic_triage_v2':
      return getAgenticTriageStatus(run);
    case 'duplicate_monitors':
    case 'breached_metrics':
      return run.extras.status === 'complete' ? 'succeeded' : run.extras.status;
  }
}

export function getWorkflowSummary(run: SeerWorkflowRun): string {
  switch (run.strategy) {
    case 'agentic_triage':
      return getAgenticTriageSummary(run);
    case 'duplicate_monitors':
      return getMonitorRunSummary(run);
    case 'agentic_triage_v2':
    case 'breached_metrics':
      // TODO: add other strategies
      return '(no summary)';
  }
}

export function WorkflowResults({
  run,
  organizationSlug,
}: {
  organizationSlug: string;
  run: SeerWorkflowRun;
}) {
  switch (run.strategy) {
    case 'agentic_triage':
      return <AgenticTriageResults run={run} organizationSlug={organizationSlug} />;
    case 'duplicate_monitors':
      return <MonitorCleanupRunResults run={run} organizationSlug={organizationSlug} />;
    case 'agentic_triage_v2':
    case 'breached_metrics':
      // TODO: add other strategies
      return null;
  }
}

export function getWorkflowRunActions(features: string[]) {
  return (Object.keys(STRATEGY_META) as WorkflowStrategy[]).flatMap(strategy => {
    const action = STRATEGY_META[strategy].runAction;
    return action && features.includes(action.feature)
      ? [{strategy, label: action.label}]
      : [];
  });
}
