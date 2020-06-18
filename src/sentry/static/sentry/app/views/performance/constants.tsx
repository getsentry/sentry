import {t} from 'app/locale';
import {SelectValue} from 'app/types';

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
    'User misery is the percentage of users who are experiencing load times 4x the base apdex rate of 300ms.'
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

type TooltipOption = SelectValue<string> & {
  tooltip: string;
};

export const AXIS_OPTIONS: TooltipOption[] = [
  {
    tooltip: PERFORMANCE_TERMS.apdex,
    value: 'apdex(300)',
    label: t('Apdex'),
  },
  {
    tooltip: PERFORMANCE_TERMS.tpm,
    value: 'epm()',
    label: t('Transactions Per Minute'),
  },
  {
    tooltip: PERFORMANCE_TERMS.failureRate,
    value: 'failure_rate()',
    label: t('Failure Rate'),
  },
  {
    tooltip: PERFORMANCE_TERMS.p50,
    value: 'p50()',
    label: t('p50 Duration'),
  },
  {
    tooltip: PERFORMANCE_TERMS.p95,
    value: 'p95()',
    label: t('p95 Duration'),
  },
  {
    tooltip: PERFORMANCE_TERMS.p99,
    value: 'p99()',
    label: t('p99 Duration'),
  },
];
