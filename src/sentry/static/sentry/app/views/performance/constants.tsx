import {t} from 'app/locale';

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
