import {
  IconBusiness,
  IconChat,
  IconCode,
  IconCopy,
  IconLab,
  IconLightning,
  IconMail,
  IconMegaphone,
  IconPlay,
  IconReleases,
  IconSiren,
  IconTimer,
} from 'sentry/icons';
import type {
  Frequency,
  NotificationChannel,
  OutputId,
  StrategyCategory,
  StrategyVisibility,
  WorkflowKind,
} from 'sentry/views/seerWorkflows/types';

export type {Frequency};

export type StrategyMeta = {
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
  autofix_followup: {
    label: 'Autofix follow-up',
    summary:
      "Reviews yesterday's autofix proposals: correctness vs. root cause, test impact, and whether an owner needs to weigh in before merging.",
    Icon: IconCode,
    frequencies: ['daily'],
    visibility: 'configurable',
    category: 'issues',
    outputs: ['issue_activity', 'notification'],
  },
  feedback_summary: {
    label: 'Feedback summary',
    summary:
      "Summarizes the day's user feedback into themes your engineering team can act on.",
    Icon: IconChat,
    frequencies: ['hourly', 'daily', 'weekly'],
    visibility: 'configurable',
    category: 'user_experience',
    outputs: ['notification'],
  },
  replay_friction_finder: {
    label: 'Replay friction finder',
    summary:
      'Surfaces Session Replay clips with elevated rage-click or dead-click density and clusters them into named UX friction themes.',
    Icon: IconPlay,
    frequencies: ['daily', 'weekly'],
    visibility: 'configurable',
    category: 'user_experience',
    outputs: ['replay_collection'],
  },
  release_regression_scout: {
    label: 'Release regression scout',
    summary:
      "Reviews each release's first 24 hours: new error types, crash-free deltas, and regressions linked to suspect commits.",
    Icon: IconReleases,
    frequencies: ['daily', 'weekly'],
    visibility: 'configurable',
    category: 'reliability',
    outputs: ['release_annotation'],
  },
  performance_regression_scout: {
    label: 'Performance regression scout',
    summary:
      "Compares this week's transaction p95s and error rates against the prior baseline. Flags degraded endpoints with span-level hypotheses and likely-culprit deploys.",
    Icon: IconLightning,
    frequencies: ['daily', 'weekly'],
    visibility: 'configurable',
    category: 'reliability',
    outputs: ['performance_annotation'],
  },
  alert_tuning_advisor: {
    label: 'Alert tuning advisor',
    summary:
      'Reviews alert rule fire history. Flags noisy, dead, or fatigue-inducing rules and proposes thresholds or sensitivity changes.',
    Icon: IconSiren,
    frequencies: ['weekly'],
    visibility: 'configurable',
    category: 'reliability',
    outputs: ['alert_rule_suggestion'],
  },
  cron_monitor_doctor: {
    label: 'Cron monitor doctor',
    summary:
      'Reviews cron monitor health. Suggests timeout, grace-period, or schedule adjustments for monitors that miss check-ins or run long.',
    Icon: IconTimer,
    frequencies: ['weekly'],
    visibility: 'configurable',
    category: 'reliability',
    outputs: ['monitor_annotation'],
  },
  duplicate_issue_merger: {
    label: 'Duplicate issue merger',
    summary:
      'Auto-detects semantically duplicate issues across fingerprints and proposes merges with confidence scores.',
    Icon: IconCopy,
    frequencies: ['daily'],
    visibility: 'internal',
    category: 'issues',
    outputs: ['merge_proposal', 'issue_activity'],
  },
  ownership_suggester: {
    label: 'Ownership suggester',
    summary:
      'Watches which engineers resolve issues touching which files. Proposes Ownership rules so future issues auto-route to the right people.',
    Icon: IconBusiness,
    frequencies: ['weekly'],
    visibility: 'internal',
    category: 'issues',
    outputs: ['ownership_suggestion'],
  },
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
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

type OutputMeta = {
  Icon: React.ComponentType<{size?: 'xs' | 'sm' | 'md'}>;
  label: string;
};

export const STRATEGY_OUTPUTS: Record<OutputId, OutputMeta> = {
  autofix_runs: {Icon: IconCode, label: 'Autofix runs'},
  issue_activity: {Icon: IconLab, label: 'Issue activity note'},
  release_annotation: {Icon: IconReleases, label: 'Release insights'},
  performance_annotation: {Icon: IconLightning, label: 'Performance markers'},
  replay_collection: {Icon: IconPlay, label: 'Replay collection'},
  alert_rule_suggestion: {Icon: IconSiren, label: 'Alert rule banner'},
  monitor_annotation: {Icon: IconTimer, label: 'Monitor banner'},
  merge_proposal: {Icon: IconCopy, label: 'Merge proposal'},
  ownership_suggestion: {Icon: IconBusiness, label: 'Ownership suggestion'},
  notification: {Icon: IconMegaphone, label: 'Notification'},
};

export function requiresNotification(kind: WorkflowKind): boolean {
  return STRATEGY_META[kind].outputs.includes('notification');
}

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

type NotificationMeta = {
  Icon: React.ComponentType<{size?: 'xs' | 'sm' | 'md'}> | null;
  label: string;
};

export const NOTIFICATION_META: Record<NotificationChannel, NotificationMeta> = {
  slack: {Icon: IconChat, label: 'Slack'},
  email: {Icon: IconMail, label: 'Email'},
  none: {Icon: null, label: 'No notifications'},
};
