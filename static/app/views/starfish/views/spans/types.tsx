import {Fragment} from 'react';

import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import DurationCell from 'sentry/views/starfish/components/tableCells/durationCell';

export type DataKey =
  | 'change'
  | 'timeSpent'
  | 'p50p95'
  | 'p50'
  | 'p95'
  | 'throughput'
  | 'duration'
  | 'errorCount'
  | 'slowFrames'
  | 'ttid';

export const DataTitles: Record<DataKey, string> = {
  change: t('Change'),
  timeSpent: t('Time Spent'),
  p50p95: t('Duration (P50, P95)'),
  p50: t('Duration (P50)'),
  p95: t('Duration (P95)'),
  duration: t('Duration'),
  errorCount: t('5XX Responses'),
  throughput: t('Throughput'),
  slowFrames: t('Slow Frames %'),
  ttid: t('Time To Initial Display'),
};

export const getTooltip = (
  key: DataKey,
  ...options: (string | number)[]
): React.ReactNode => {
  if (key === 'timeSpent') {
    return (
      <Fragment>
        <div>
          <DurationCell milliseconds={options[0] as number} />
        </div>
        <Link to="/starfish/definitions/">{t('How was this calculated?')}</Link>
      </Fragment>
    );
  }
  return '';
};

export const getThroughputTitle = (spanOp?: string) => {
  if (spanOp?.startsWith('db')) {
    return t('Queries');
  }
  if (spanOp) {
    return t('Requests');
  }
  return '--';
};

export const getThroughputChartTitle = (spanOp?: string) => {
  if (spanOp?.startsWith('db')) {
    return t('Queries Per Second');
  }
  if (spanOp) {
    return t('Requests Per Second');
  }
  return '--';
};
