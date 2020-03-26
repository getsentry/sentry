import {t} from 'app/locale';
import pinIcon from 'app/../images/graph/icon-location-filled.svg';
import {NewQuery} from 'app/types';

export const PIN_ICON = `image://${pinIcon}`;

export const DEFAULT_EVENT_VIEW: Readonly<NewQuery> = {
  id: undefined,
  name: t('All Events'),
  query: '',
  projects: [],
  fields: ['title', 'event.type', 'project', 'user', 'timestamp'],
  orderby: '-timestamp',
  version: 2,
  range: '24h',
};

export const TRANSACTION_VIEWS: Readonly<Array<NewQuery>> = [
  {
    id: undefined,
    name: t('Transactions'),
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
  },
  {
    id: undefined,
    name: t('Errors by URL'),
    fields: ['url', 'count()', 'count_unique(issue.id)'],
    orderby: '-count',
    query: 'event.type:error',
    projects: [],
    version: 2,
    range: '24h',
  },
];
