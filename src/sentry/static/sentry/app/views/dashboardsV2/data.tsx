import {t} from 'app/locale';

import {PrebuiltDashboard} from './types';

export const PREBUILT_DASHBOARDS: PrebuiltDashboard[] = [
  {
    type: 'prebuilt',
    title: t('All Events (prebuilt)'),
    widgets: [],
  },
];

export const EMPTY_DASHBOARD: PrebuiltDashboard = {
  type: 'prebuilt',
  title: t('Untitled dashboard'),
  widgets: [],
};

export const DISPLAY_TYPE_CHOICES = [
  {label: t('Area chart'), value: 'area'},
  {label: t('Bar chart'), value: 'bar'},
  {label: t('Line chart'), value: 'line'},
];

export const INTERVAL_CHOICES = [
  {label: t('1 Minute'), value: '1m'},
  {label: t('5 Minutes'), value: '5m'},
  {label: t('15 Minutes'), value: '15m'},
  {label: t('30 Minutes'), value: '30m'},
  {label: t('1 Hour'), value: '1h'},
  {label: t('1 Day'), value: '1d'},
];
