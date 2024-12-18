import {t} from 'sentry/locale';
import {ModuleName} from 'sentry/views/insights/types';

export const FRONTEND_LANDING_SUB_PATH = 'frontend';
export const FRONTEND_LANDING_TITLE = t('Frontend');
export const FRONTEND_SIDEBAR_LABEL = t('Frontend');

export const OVERVIEW_PAGE_ALLOWED_OPS = [
  'pageload',
  'navigation',
  'ui.render',
  'interaction',
];

export const MODULES = [ModuleName.VITAL, ModuleName.HTTP, ModuleName.RESOURCE];
