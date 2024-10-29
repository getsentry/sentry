import {t} from 'sentry/locale';

export const MOBILE_LANDING_SUB_PATH = 'mobile';
export const MOBILE_LANDING_TITLE = t('Mobile');
export const MOBILE_OVERVIEW_PAGE_TITLE = t('Mobile Performance');

export const OVERVIEW_PAGE_ALLOWED_OPS = [
  'ui.action.swipe',
  'ui.action.scroll',
  'ui.action.click',
  'ui.load',
  'app.lifecycle',
  // navigation and pageload are seen in react-native
  'navigation',
  'pageload',
];
