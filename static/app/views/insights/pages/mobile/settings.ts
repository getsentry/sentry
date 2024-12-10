import {t} from 'sentry/locale';
import {ModuleName} from 'sentry/views/insights/types';

export const MOBILE_LANDING_SUB_PATH = 'mobile';
export const MOBILE_LANDING_TITLE = t('Mobile Performance');
export const MOBILE_SIDEBAR_LABEL = t('Mobile');

export const OVERVIEW_PAGE_ALLOWED_OPS = [
  'ui.action.swipe',
  'ui.action.scroll',
  'ui.action.click',
  'ui.action',
  'ui.load',
  'app.lifecycle',
  // navigation and pageload are seen in react-native
  'navigation',
  'pageload',
];

export const MODULES = [
  ModuleName.APP_START,
  ModuleName.SCREEN_LOAD,
  ModuleName.SCREEN_RENDERING,
  ModuleName.MOBILE_SCREENS,
  ModuleName.MOBILE_UI,
];
