import {t} from 'sentry/locale';

const PROGRESS_STATE_LABELS: Record<string, string> = {
  identified: t('Identified'),
  triaged: t('Triaged'),
  diagnosed: t('Diagnosed'),
  fix_proposed: t('Fix Proposed'),
  fix_applied: t('Fix Applied'),
};

export function formatProgressState(state: string | null | undefined): string {
  if (!state) {
    return '—';
  }
  return PROGRESS_STATE_LABELS[state] ?? state;
}
