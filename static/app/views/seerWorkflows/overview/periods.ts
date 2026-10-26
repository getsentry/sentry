import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';

const WINDOW_LABELS: Record<keyof typeof DEFAULT_RELATIVE_PERIODS, string> = {
  '1h': t('in the last hour'),
  '24h': t('in the last 24 hours'),
  '7d': t('in the last 7 days'),
  '14d': t('in the last 14 days'),
  '30d': t('in the last 30 days'),
  '90d': t('in the last 90 days'),
};

// Absolute ranges (no relative period) get no phrase, so callers drop the
// window clause rather than naming a window the numbers don't cover.
export function periodWindowLabel(statsPeriod: string | null): string {
  if (!statsPeriod) {
    return '';
  }
  return WINDOW_LABELS[statsPeriod as keyof typeof WINDOW_LABELS] ?? '';
}
