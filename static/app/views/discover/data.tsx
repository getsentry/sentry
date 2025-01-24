import {t} from 'sentry/locale';
import type {NewQuery, Organization} from 'sentry/types/organization';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';

export const DEFAULT_EVENT_VIEW: Readonly<NewQuery> = {
  id: undefined,
  name: t('All Events'),
  query: '',
  projects: [],
  fields: ['title', 'event.type', 'project', 'user.display', 'timestamp'],
  orderby: '-timestamp',
  version: 2,
  range: '24h',
  queryDataset: SavedQueryDatasets.ERRORS,
};

const DEFAULT_TRANSACTION_VIEW: Readonly<NewQuery> = {
  id: undefined,
  name: t('All Transactions'),
  query: '',
  projects: [],
  fields: ['title', 'project', 'user.display', 'timestamp'],
  orderby: '-timestamp',
  version: 2,
  range: '24h',
  queryDataset: SavedQueryDatasets.TRANSACTIONS,
};

const DEFAULT_ERROR_VIEW: Readonly<NewQuery> = {
  id: undefined,
  name: t('All Errors'),
  query: '',
  projects: [],
  fields: ['title', 'project', 'user.display', 'timestamp'],
  orderby: '-timestamp',
  version: 2,
  range: '24h',
  queryDataset: SavedQueryDatasets.ERRORS,
};

export const DEFAULT_EVENT_VIEW_MAP: Record<SavedQueryDatasets, Readonly<NewQuery>> = {
  [SavedQueryDatasets.DISCOVER]: DEFAULT_EVENT_VIEW,
  [SavedQueryDatasets.ERRORS]: DEFAULT_ERROR_VIEW,
  [SavedQueryDatasets.TRANSACTIONS]: DEFAULT_TRANSACTION_VIEW,
};

export const getTransactionViews = (organization: Organization) => {
  const hasDatasetSelectorFeature = hasDatasetSelector(organization);
  return [
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
      query: hasDatasetSelectorFeature ? '' : 'event.type:transaction',
      projects: [],
      version: 2,
      range: '24h',
      queryDataset: SavedQueryDatasets.TRANSACTIONS,
    },
  ] as readonly NewQuery[];
};

export const getWebVitalsViews = (organization: Organization) => {
  const hasDatasetSelectorFeature = hasDatasetSelector(organization);
  return [
    {
      id: undefined,
      name: t('Web Vitals'),
      fields: [
        'transaction',
        'epm()',
        'p75(measurements.fp)',
        'p75(measurements.fcp)',
        'p75(measurements.lcp)',
        'p75(measurements.fid)',
        'p75(measurements.cls)',
      ],
      orderby: '-epm',
      query: hasDatasetSelectorFeature
        ? 'transaction.op:pageload'
        : 'event.type:transaction transaction.op:pageload',
      projects: [],
      version: 2,
      range: '24h',
      yAxis: ['epm()'],
      queryDataset: SavedQueryDatasets.TRANSACTIONS,
    },
  ] as readonly NewQuery[];
};

export const getAllViews = (organization: Organization) => {
  const hasDatasetSelectorFeature = hasDatasetSelector(organization);
  return [
    DEFAULT_EVENT_VIEW,
    {
      id: undefined,
      name: t('Errors by Title'),
      fields: ['title', 'count()', 'count_unique(user)', 'project'],
      orderby: '-count',
      query: hasDatasetSelectorFeature ? '' : 'event.type:error',
      projects: [],
      version: 2,
      range: '24h',
      display: 'top5',
      queryDataset: SavedQueryDatasets.ERRORS,
    },
    {
      id: undefined,
      name: t('Errors by URL'),
      fields: ['url', 'count()', 'count_unique(issue)'],
      orderby: '-count',
      query: hasDatasetSelectorFeature ? 'has:url' : 'event.type:error has:url',
      projects: [],
      version: 2,
      range: '24h',
      display: 'top5',
      queryDataset: SavedQueryDatasets.ERRORS,
    },
  ] as readonly NewQuery[];
};
