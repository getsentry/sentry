import {t} from 'app/locale';

export const PERFORMANCE_TERMS: Record<string, string> = {
  apdex: t(
    'Apdex is the ratio of both satisfactory and tolerable response times to all response times.'
  ),
  tpm: t('TPM is the number of recorded transaction events per minute.'),
  errorRate: t(
    'Error rate is the percentage of recorded transactions that had a known and unsuccessful status.'
  ),
};

export const TOP_TRANSACTION_LIMIT = 5;

export const TOP_TRANSACTION_FILTERS = [
  {
    sort: {kind: 'desc', field: 'transaction.duration'},
    value: 'slowest',
    label: t('Slowest Transactions'),
  },
  {
    sort: {kind: 'asc', field: 'transaction.duration'},
    value: 'fastest',
    label: t('Fastest Transactions'),
  },
  {
    sort: {kind: 'desc', field: 'timestamp'},
    value: 'recent',
    label: t('Recent Transactions'),
  },
] as const;
