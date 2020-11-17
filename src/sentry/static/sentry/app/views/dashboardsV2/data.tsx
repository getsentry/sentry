import {t} from 'app/locale';

import {PrebuiltDashboard} from './types';

export const PREBUILT_DASHBOARDS: PrebuiltDashboard[] = [
  {
    type: 'prebuilt',
    dashboard: {
      name: t('All Events (prebuilt)'),
      widgets: [],
    },
  },
];
