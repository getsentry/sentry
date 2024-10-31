import {t} from 'sentry/locale';
import {MODULES as AI_MODULES} from 'sentry/views/insights/pages/ai/settings';
import {MODULES as BACKEND_MODULES} from 'sentry/views/insights/pages/backend/settings';
import {MODULES as FRONTEND_MODULES} from 'sentry/views/insights/pages/frontend/settings';
import {MODULES as MOBILE_MODULES} from 'sentry/views/insights/pages/mobile/settings';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import type {ModuleName} from 'sentry/views/insights/types';

export const OVERVIEW_PAGE_TITLE = t('Overview');
export const DOMAIN_VIEW_BASE_URL = 'insights';
export const DOMAIN_VIEW_BASE_TITLE = t('Insights');

export const DOMAIN_VIEW_MODULES: Record<DomainView, ModuleName[]> = {
  frontend: FRONTEND_MODULES,
  backend: BACKEND_MODULES,
  ai: AI_MODULES,
  mobile: MOBILE_MODULES,
};
