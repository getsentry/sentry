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
