import {Fragment} from 'react';

import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';

export type DataKey =
  | 'timeSpent'
  | 'p50p95'
  | 'p50'
  | 'p95'
  | 'throughput'
  | 'errorCount';

export const DataTitles: Record<DataKey, string> = {
  timeSpent: t('Time Spent'),
  p50p95: t('Duration (P50, P95)'),
  p50: t('Duration (P50)'),
  p95: t('Duration (P95)'),
  errorCount: t('5xx Responses'),
  throughput: t('Throughput'),
};

export const getTooltip = (
  key: DataKey,
  ...options: (string | number)[]
): React.ReactNode => {
  if (key === 'timeSpent') {
    const spanTime = `${(Number(options[0]) / 1000).toFixed(2)}s`;
    return (
      <Fragment>
        <div>{spanTime}</div>
        <Link to="/starfish/definitions">How was this calculated?</Link>
      </Fragment>
    );
  }
  return '';
};
