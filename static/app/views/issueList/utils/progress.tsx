import type {ReactNode} from 'react';

import {Tag} from '@sentry/scraps/badge';

import {ProgressMarker, type ProgressMarkerStep} from 'sentry/components/progressMarker';
import {t} from 'sentry/locale';
import {ProgressState} from 'sentry/types/group';
import type {TagVariant} from 'sentry/utils/theme';
import type {IconSize} from 'sentry/utils/theme/types';

/**
 * Display names only — the underlying `ProgressState` values are persisted in
 * `GroupDerivedData` and are the public `issue.progress:` search values, so they
 * intentionally keep their original names. Expect labels and values to read
 * differently (e.g. `fix_proposed` displays as "PR Created").
 */
const PROGRESS_STATE_LABELS: Record<ProgressState, string> = {
  [ProgressState.IDENTIFIED]: t('Identified'),
  [ProgressState.ASSIGNED]: t('Triaged'),
  [ProgressState.DIAGNOSED]: t('Diagnosed'),
  [ProgressState.FIX_PROPOSED]: t('PR Created'),
  [ProgressState.FIX_APPLIED]: t('PR Merged'),
};

export function formatProgressState(state: ProgressState | null): string {
  if (!state) {
    return '—';
  }
  return PROGRESS_STATE_LABELS[state] ?? state;
}

const PROGRESS_STATE_STEPS: Record<ProgressState, ProgressMarkerStep> = {
  [ProgressState.IDENTIFIED]: 'empty',
  [ProgressState.ASSIGNED]: 'quarter',
  [ProgressState.DIAGNOSED]: 'half',
  [ProgressState.FIX_PROPOSED]: 'three-quarters',
  [ProgressState.FIX_APPLIED]: 'complete',
};

export function getProgressIcon(state: ProgressState | null, size?: IconSize): ReactNode {
  if (!state) {
    return null;
  }
  const step = PROGRESS_STATE_STEPS[state];
  return step ? <ProgressMarker step={step} size={size} /> : null;
}

const PROGRESS_STATE_TAG_VARIANTS: Record<ProgressState, TagVariant> = {
  [ProgressState.IDENTIFIED]: 'muted',
  [ProgressState.ASSIGNED]: 'muted',
  [ProgressState.DIAGNOSED]: 'warning',
  [ProgressState.FIX_PROPOSED]: 'success',
  [ProgressState.FIX_APPLIED]: 'success',
};

/** Progress state as a colored tag with a leading icon (e.g. a green "PR Created"). */
export function IssueProgressTag({state}: {state: ProgressState | null}) {
  if (!state) {
    return null;
  }
  return (
    <Tag variant={PROGRESS_STATE_TAG_VARIANTS[state]} icon={getProgressIcon(state, 'xs')}>
      {formatProgressState(state)}
    </Tag>
  );
}
