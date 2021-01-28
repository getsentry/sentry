import {t} from 'app/locale';

import {DashboardDetails} from './types';

export const EMPTY_DASHBOARD: DashboardDetails = {
  id: '',
  dateCreated: '',
  createdBy: '',
  title: t('Untitled dashboard'),
  widgets: [],
};

export const DISPLAY_TYPE_CHOICES = [
  {label: t('Area chart'), value: 'area'},
  {label: t('Bar chart'), value: 'bar'},
  {label: t('Line chart'), value: 'line'},
  {label: t('Table results'), value: 'table'},
  {label: t('World Map'), value: 'world_map'},
];

export const INTERVAL_CHOICES = [
  {label: t('1 Minute'), value: '1m'},
  {label: t('5 Minutes'), value: '5m'},
  {label: t('15 Minutes'), value: '15m'},
  {label: t('30 Minutes'), value: '30m'},
  {label: t('1 Hour'), value: '1h'},
  {label: t('1 Day'), value: '1d'},
];

export const DEFAULT_STATS_PERIOD = '24h';
