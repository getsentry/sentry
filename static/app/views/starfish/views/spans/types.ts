import {t} from 'sentry/locale';

export type DataKey = 'timeSpent' | 'p50p95' | 'p50' | 'p95';

export const DataTitles: Record<DataKey, string> = {
  timeSpent: t('Time Spent'),
  p50p95: t('Duration (P50, P95)'),
  p50: t('Duration (P50)'),
  p95: t('Duration (P95)'),
};

export const getTooltip = (key: DataKey, ...options: (string | number)[]): string => {
  if (key === 'timeSpent') {
    const spanTime = `${(Number(options[0]) / 1000).toFixed(2)}s`;
    const endTime = `${(Number(options[1]) / 1000).toFixed(2)}s`;
    return t(
      `The total span time (%s) out of the total app time (%s)`,
      spanTime,
      endTime
    );
  }
  return '';
};
