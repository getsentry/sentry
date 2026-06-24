import type {ReactNode} from 'react';

import {IconCircle} from 'sentry/icons/iconCircle';
import {IconCircleCheckmark} from 'sentry/icons/iconCircleCheckmark';
import {IconPieHalf} from 'sentry/icons/iconPieHalf';
import {IconPieQuarter} from 'sentry/icons/iconPieQuarter';
import {IconPieThreeQuarters} from 'sentry/icons/iconPieThreeQuarters';
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
  [ProgressState.ASSIGNED]: <IconPieQuarter size="md" variant="muted" />,
  [ProgressState.DIAGNOSED]: <IconPieHalf size="md" variant="warning" />,
  [ProgressState.FIX_PROPOSED]: <IconPieThreeQuarters size="md" variant="success" />,
  [ProgressState.FIX_APPLIED]: <IconCircleCheckmark size="md" variant="success" />,
};

export function getProgressIcon(state: ProgressState | null): ReactNode {
  if (!state) {
    return null;
  }
  return PROGRESS_STATE_ICONS[state] ?? null;
}
