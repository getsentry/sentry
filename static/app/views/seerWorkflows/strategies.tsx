import {IconLab} from 'sentry/icons';
import type {
  Frequency,
  OutputId,
  StrategyCategory,
  StrategyVisibility,
  WorkflowKind,
} from 'sentry/views/seerWorkflows/types';

type StrategyMeta = {
  Icon: React.ComponentType<{size?: 'xs' | 'sm' | 'md'}>;
  category: StrategyCategory;
  frequencies: Frequency[];
  label: string;
  outputs: OutputId[];
  summary: string;
  visibility: StrategyVisibility;
};

export const STRATEGY_META: Record<WorkflowKind, StrategyMeta> = {
  agentic_triage: {
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

// Maps raw triage action enum values to human-readable labels for the
// user-facing issue list. Falls back to the raw value for unknown verbs.
const ACTION_LABELS: Record<string, string> = {
  autofix: 'Autofix queued',
  autofix_triggered: 'Autofix queued',
  root_cause_only: 'Root cause analysis',
  skip: 'Skipped',
};

export function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

// Maps the skip_reason categories Seer sends to display labels. skip_reason is
// an open passthrough string, so unknown values get their underscores
// humanized rather than dropped.
const SKIP_REASON_LABELS: Record<string, string> = {
  duplicate: 'duplicate',
  insufficient_info: 'insufficient info',
  environmental: 'environmental',
  ambiguous_root_cause: 'ambiguous root cause',
  other: 'other',
};

export function getSkipReasonLabel(skipReason: string): string {
  return SKIP_REASON_LABELS[skipReason] ?? skipReason.replaceAll('_', ' ');
}
