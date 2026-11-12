import type {ReactNode} from 'react';

import {ProgressMarker, type ProgressMarkerStep} from 'sentry/components/progressMarker';
import {t} from 'sentry/locale';
import {ProgressState} from 'sentry/types/group';

const PROGRESS_STATE_LABELS: Record<ProgressState, string> = {
  [ProgressState.IDENTIFIED]: t('Identified'),
  [ProgressState.ASSIGNED]: t('Assigned'),
  [ProgressState.DIAGNOSED]: t('Diagnosed'),
  [ProgressState.FIX_PROPOSED]: t('Fix Proposed'),
  [ProgressState.FIX_APPLIED]: t('Fix Applied'),
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

export function getProgressIcon(state: ProgressState | null): ReactNode {
  if (!state) {
    return null;
  }
  const step = PROGRESS_STATE_STEPS[state];
  return step ? <ProgressMarker step={step} /> : null;
}
