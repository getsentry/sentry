import {t} from 'sentry/locale';

import type {DashboardDetails} from './types';

export const EMPTY_DASHBOARD: DashboardDetails = {
  id: '',
  dateCreated: '',
  createdBy: undefined,
  title: t('Untitled dashboard'),
  widgets: [],
  projects: [],
  filters: {},
};

export const DEFAULT_STATS_PERIOD = '24h';
