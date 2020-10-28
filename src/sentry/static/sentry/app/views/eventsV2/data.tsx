import {t} from 'app/locale';
import {NewQuery} from 'app/types';

export const DEFAULT_EVENT_VIEW: Readonly<NewQuery> = {
  id: undefined,
  name: t('All Events'),
  query: '',
  projects: [],
  fields: ['title', 'event.type', 'project', 'user.display', 'timestamp'],
  orderby: '-timestamp',
  version: 2,
  range: '24h',
};

export const TRANSACTION_VIEWS: Readonly<Array<NewQuery>> = [
  {
    id: undefined,
    name: t('Transactions by Volume'),
    fields: [
      'transaction',
      'project',
      'count()',
      'avg(transaction.duration)',
      'p75()',
      'p95()',
    ],
    orderby: '-count',
    query: 'event.type:transaction',
    projects: [],
    version: 2,
    range: '24h',
  },
];

export const ALL_VIEWS: Readonly<Array<NewQuery>> = [
  DEFAULT_EVENT_VIEW,
  {
    id: undefined,
    name: t('Errors by Title'),
    fields: ['title', 'count()', 'count_unique(user)', 'project'],
    orderby: '-count',
    query: 'event.type:error',
    projects: [],
    version: 2,
    range: '24h',
    display: 'top5',
  },
  {
    id: undefined,
    name: t('Errors by URL'),
    fields: ['url', 'count()', 'count_unique(issue)'],
    orderby: '-count',
    query: 'event.type:error has:url',
    projects: [],
    version: 2,
    range: '24h',
    display: 'top5',
  },
];
