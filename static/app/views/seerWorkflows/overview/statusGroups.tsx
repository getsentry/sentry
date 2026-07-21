import {
  IconCode,
  IconCommit,
  IconMerge,
  IconPullRequest,
  IconSearch,
  IconSeer,
  IconUser,
  IconWarning,
} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';

import type {AttentionReason, OverviewRow} from './types';

// The list's Linear-style sections: the triage tiers made visible. Attention
// states reuse their keys; needs_investigation covers settled diagnosis-only
// runs (manual next steps, no one-click pipeline action), running/merged the
// rows with nothing left to do.
export type StatusGroupKey =
  | AttentionReason
  | 'needs_investigation'
  | 'running'
  | 'merged';

// Most urgent first — the group order IS the old "Needs you first" sort.
// Everything human-actionable (including manual investigation) sits above
// Running, which needs nothing from the reader.
export const STATUS_GROUP_ORDER: StatusGroupKey[] = [
  'awaiting_input',
  'review_pr',
  'code_changes_ready',
  'solution_ready',
  'errored',
  'needs_investigation',
  'running',
  'merged',
];

export const STATUS_GROUP_META: Record<
  StatusGroupKey,
  {Icon: React.ComponentType<SVGIconProps>; label: string}
> = {
  awaiting_input: {Icon: IconUser, label: t('Needs your input')},
  review_pr: {Icon: IconPullRequest, label: t('Awaiting your review')},
  code_changes_ready: {Icon: IconCommit, label: t('Code changes ready')},
  solution_ready: {Icon: IconCode, label: t('Ready to generate code')},
  errored: {Icon: IconWarning, label: t('Errored')},
  // Same magnifier as the cards' Diagnosis block: these runs stopped at a
  // diagnosis, and their Next-steps bullets are manual verify/decide work.
  needs_investigation: {Icon: IconSearch, label: t('Needs investigation')},
  running: {Icon: IconSeer, label: t('Running')},
  merged: {Icon: IconMerge, label: t('Merged')},
};

/**
 * Which section a row belongs to. Precedence mirrors the card's own header
 * logic: a merged win outranks everything, an in-flight run has nothing
 * actionable yet, then the attention states. The remainder — diagnosis-only
 * runs (and rows whose state is still loading) — needs a human to work the
 * manual next steps: `getAttentionReason` returning null only means no
 * one-click pipeline button exists, not that there is nothing to do.
 */
export function getStatusGroup(
  row: OverviewRow,
  attention: AttentionReason | null
): StatusGroupKey {
  if (row.prMerged) {
    return 'merged';
  }
  if (row.isProcessing) {
    return 'running';
  }
  if (attention) {
    return attention;
  }
  return 'needs_investigation';
}
