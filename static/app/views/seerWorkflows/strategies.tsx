import {IconCopy} from 'sentry/icons';
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
  icon?: React.ReactNode;
  runAction?: {feature: string; label: string};
};

export const STRATEGY_META: Record<WorkflowStrategy, StrategyMeta> = {
  duplicate_monitors: {
    icon: <IconCopy size="xs" variant="muted" aria-hidden />,
    runAction: {
      feature: 'seer-workflows-monitor-cleanup',
      label: t('Monitor scan'),
    },
    label: 'Duplicate monitors',
  },
  agentic_triage: {
    label: 'Agentic triage',
  },
};

export function getWorkflowStatus(run: SeerWorkflowRun): WorkflowDisplayStatus {
  switch (run.strategy) {
    case 'agentic_triage':
      return getAgenticTriageStatus(run);
    case 'duplicate_monitors':
      return run.extras.status === 'complete' ? 'succeeded' : run.extras.status;
  }
}

export function getWorkflowSummary(run: SeerWorkflowRun): string {
  switch (run.strategy) {
    case 'agentic_triage':
      return getAgenticTriageSummary(run);
    case 'duplicate_monitors':
      return getMonitorRunSummary(run);
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
