import {t} from 'app/locale';

export const PERFORMANCE_TERMS: Record<string, string> = {
  apdex: t(
    'Apdex is the ratio of both satisfactory and tolerable response times to all response times.'
  ),
  tpm: t('TPM is the number of recorded transaction events per minute.'),
  failureRate: t(
    'Failure rate is the percentage of recorded transactions that had a known and unsuccessful status.'
  ),
  p50: t('p50 indicates the duration that 50% of transactions are faster than.'),
  p95: t('p95 indicates the duration that 95% of transactions are faster than.'),
  p99: t('p99 indicates the duration that 99% of transactions are faster than.'),
  userMisery: t(
    "User misery is the percentage of users who are experiencing load times 4x your organization's apdex threshold."
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
