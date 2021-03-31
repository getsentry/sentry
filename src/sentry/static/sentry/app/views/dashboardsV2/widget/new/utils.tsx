import {t} from 'app/locale';

import {DisplayType} from '../../types';

export const visualizationColors = [{label: t('Default Color'), value: 'purple'}];

export const metrics = [
  'sentry.response',
  'sentry.events.failed',
  'sentry.events.processed',
  'sentry.events.processed.javascript',
  'sentry.events.processed.java',
  'sentry.events.processed.node',
  'symbolicator.healthcheck',
];

export const metricTags = {
  browser: {values: [], key: 'browser', name: 'Browser', value: 'Chrome 89.0.4389'},
  'browser.name': {
    values: [],
    name: 'Browser.Name',
    key: 'browser.name',
    value: 'Chrome',
  },
  'device.family': {
    values: [],
    name: 'Device.Family',
    key: 'device.family',
    value: 'Mac',
  },
  environment: {values: [], name: 'Environment', key: 'environment', value: 'prod'},
  'http.status_code': {
    values: [],
    name: 'Http.Status_Code',
    key: 'http.status_code',
    value: '200',
  },
};

export const metricGroupByOptions = [
  ['status.code', 'status.code'],
  ['method', 'method'],
];

// The aggregation method chosen determines how the metrics are aggregated into a single line
export enum Aggregation {
  COUNTER = 'counter',
  DISTRIBUTION = 'distribution',
  SET = 'set',
  GAUGE = 'gauge',
}

export const displayTypes = {
  [DisplayType.AREA]: t('Area Chart'),
  [DisplayType.BAR]: t('Bar Chart'),
  [DisplayType.LINE]: t('Line Chart'),
  [DisplayType.TABLE]: t('Table'),
  [DisplayType.WORLD_MAP]: t('World Map'),
  [DisplayType.BIG_NUMBER]: t('Big Number'),
};
