import type {ReactNode} from 'react';

import {IconCircle} from 'sentry/icons/iconCircle';
import {IconInProgress} from 'sentry/icons/iconInProgress';
import {IconInReview} from 'sentry/icons/iconInReview';
import {IconResolved} from 'sentry/icons/iconResolved';
import {t} from 'sentry/locale';

export enum ProgressState {
  IDENTIFIED = 'identified',
  ASSIGNED = 'assigned',
  DIAGNOSED = 'diagnosed',
  FIX_PROPOSED = 'fix_proposed',
  FIX_APPLIED = 'fix_applied',
}

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

const PROGRESS_STATE_ICONS: Record<ProgressState, ReactNode> = {
  [ProgressState.IDENTIFIED]: <IconCircle size="md" variant="muted" />,
  [ProgressState.ASSIGNED]: <IconCircle size="md" variant="muted" />,
  [ProgressState.DIAGNOSED]: <IconInProgress size="md" variant="warning" />,
  [ProgressState.FIX_PROPOSED]: <IconInReview size="md" variant="success" />,
  [ProgressState.FIX_APPLIED]: <IconResolved size="md" variant="success" />,
};

export function getProgressIcon(state: ProgressState | null): ReactNode {
  if (!state) {
    return null;
  }
  return PROGRESS_STATE_ICONS[state] ?? null;
}
