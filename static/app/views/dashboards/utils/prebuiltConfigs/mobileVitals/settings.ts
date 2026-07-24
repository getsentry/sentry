import {t} from 'sentry/locale';

export const DASHBOARD_TITLE = t('Mobile Vitals');
export const APP_STARTS_DASHBOARD_TITLE = t('Mobile Vitals App Starts');
export const SCREEN_LOADS_DASHBOARD_TITLE = t('Mobile Vitals Screen Loads');
export const SCREEN_RENDERING_DASHBOARD_TITLE = t('Mobile Vitals Screen Rendering');

export const DASHBOARD_DESCRIPTION = t(
  'Screen performance: app starts, frame rates, and TTID/TTFD scores.'
);
export const APP_STARTS_DASHBOARD_DESCRIPTION = t(
  'Cold and warm start times, with causes of slow starts.'
);
export const SCREEN_LOADS_DASHBOARD_DESCRIPTION = t(
  'TTID and TTFD over time, by device class and contributing span operations.'
);
export const SCREEN_RENDERING_DASHBOARD_DESCRIPTION = t(
  'Slow and frozen frame rates and frame delay, by span operation.'
);
