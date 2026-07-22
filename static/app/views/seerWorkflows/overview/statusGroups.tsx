import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  IconCode,
  IconCommit,
  IconMerge,
  IconPullRequest,
  IconSearch,
} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t, tn} from 'sentry/locale';

import type {AutofixStateKey} from './useAutofixSections';

// The list's status sections. needs_investigation covers settled
// diagnosis-only runs (manual next steps, no one-click pipeline action);
// merged covers rows with nothing left to do.
export type StatusGroupKey = AutofixStateKey;

interface StatusGroupMeta {
  Icon: React.ComponentType<SVGIconProps>;
  label: string;
  // How far through the pipeline every member of this group is (1-4). Unset
  // for variable-stage groups and merged.
  fill?: number;
}

export const STATUS_GROUP_META: Record<StatusGroupKey, StatusGroupMeta> = {
  review_pr: {Icon: IconPullRequest, label: t('Awaiting your review'), fill: 4},
  code_changes_ready: {Icon: IconCommit, label: t('Code changes ready'), fill: 3},
  solution_ready: {Icon: IconCode, label: t('Ready to generate code'), fill: 2},
  // Same magnifier as the card's Investigate action: these runs stopped at a
  // root cause, and their next steps are manual verify/decide work.
  needs_investigation: {Icon: IconSearch, label: t('Needs investigation'), fill: 1},
  merged: {Icon: IconMerge, label: t('Merged')},
};

const STEP_LABELS = [
  t('Root cause'),
  t('Plan'),
  t('Code changes'),
  t('PR opened'),
  t('Merged'),
];

/**
 * The pipeline checklist for a group's header icon: where every card in the
 * group is and how many steps remain until the fix lands. Staged groups get
 * the ✓/○ rows; variable-stage groups get their one-line description.
 */
export function StatusGroupTooltip({groupKey}: {groupKey: StatusGroupKey}) {
  const meta = STATUS_GROUP_META[groupKey];
  const merged = groupKey === 'merged';
  const fill = meta.fill ?? STEP_LABELS.length;

  return (
    <Stack gap="2xs" align="stretch">
      <Text size="xs" bold variant={merged ? 'success' : 'primary'} align="left">
        {merged
          ? t('Issue fixed')
          : tn(
              '%s step until issue fix',
              '%s steps until issue fix',
              STEP_LABELS.length - fill
            )}
      </Text>
      {STEP_LABELS.map((label, index) =>
        index < fill ? (
          <Text key={label} size="xs" variant="success" align="left">
            {`✓ ${label}`}
          </Text>
        ) : (
          <Text key={label} size="xs" variant="muted" align="left">
            {`○ ${label}`}
          </Text>
        )
      )}
    </Stack>
  );
}
