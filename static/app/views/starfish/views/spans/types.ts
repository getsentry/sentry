import {t} from 'sentry/locale';

export type DataKey = 'timeSpent';

export const DataTitles: Record<DataKey, string> = {
  timeSpent: t('Time Spent'),
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
