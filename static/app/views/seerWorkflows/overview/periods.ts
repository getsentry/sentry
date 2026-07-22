import {t} from 'sentry/locale';

export const DEFAULT_STATS_PERIOD = '90d';

export const PERIOD_FILTER_OPTIONS: Array<{label: string; value: string}> = [
  {value: '24h', label: t('Last 24 hours')},
  {value: '7d', label: t('Last 7 days')},
  {value: '30d', label: t('Last 30 days')},
  {value: '90d', label: t('Last 90 days')},
];

export function periodWindowLabel(statsPeriod: string): string {
  const option =
    PERIOD_FILTER_OPTIONS.find(candidate => candidate.value === statsPeriod) ??
    PERIOD_FILTER_OPTIONS.find(candidate => candidate.value === DEFAULT_STATS_PERIOD)!;
  return t('in the %s', option.label.toLowerCase());
}
