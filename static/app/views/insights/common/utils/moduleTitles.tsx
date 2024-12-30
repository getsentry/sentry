import {MODULE_TITLE as RESOURCES_MODULE_TITLE} from 'sentry/views/insights/browser/resources/settings';
import {MODULE_TITLE as VITALS_MODULE_TITLE} from 'sentry/views/insights/browser/webVitals/settings';
import {MODULE_TITLE as CACHE_MODULE_TITLE} from 'sentry/views/insights/cache/settings';
import {MODULE_TITLE as CRONS_MODULE_TITLE} from 'sentry/views/insights/crons/settings';
import {MODULE_TITLE as DB_MODULE_TITLE} from 'sentry/views/insights/database/settings';
import {
  FRONTEND_MODULE_TITLE as HTTP_FRONTEND_MODULE_TITLE,
  MOBILE_MODULE_TITLE as HTTP_MOBILE_MODULE_TITLE,
  MODULE_TITLE as HTTP_MODULE_TITLE,
} from 'sentry/views/insights/http/settings';
import {MODULE_TITLE as AI_MODULE_TITLE} from 'sentry/views/insights/llmMonitoring/settings';
import {MODULE_TITLE as APP_STARTS_MODULE_TITLE} from 'sentry/views/insights/mobile/appStarts/settings';
import {MODULE_TITLE as SCREEN_LOADS_MODULE_TITLE} from 'sentry/views/insights/mobile/screenload/settings';
import {MODULE_TITLE as SCREEN_RENDERING_MODULE_TITLE} from 'sentry/views/insights/mobile/screenRendering/settings';
import {MODULE_TITLE as MOBILE_VITALS_MODULE_TITLE} from 'sentry/views/insights/mobile/screens/settings';
import {MODULE_TITLE as MOBILE_UI_MODULE_TITLE} from 'sentry/views/insights/mobile/ui/settings';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {MODULE_TITLE as QUEUE_MODULE_TITLE} from 'sentry/views/insights/queues/settings';
import {ModuleName} from 'sentry/views/insights/types';
import {MODULE_TITLE as UPTIME_MODULE_TITLE} from 'sentry/views/insights/uptime/settings';

export const MODULE_TITLES: Record<ModuleName, string> = {
  [ModuleName.DB]: DB_MODULE_TITLE,
  [ModuleName.HTTP]: HTTP_MODULE_TITLE,
  [ModuleName.CACHE]: CACHE_MODULE_TITLE,
  [ModuleName.QUEUE]: QUEUE_MODULE_TITLE,
  [ModuleName.SCREEN_LOAD]: SCREEN_LOADS_MODULE_TITLE,
  [ModuleName.APP_START]: APP_STARTS_MODULE_TITLE,
  [ModuleName.VITAL]: VITALS_MODULE_TITLE,
  [ModuleName.RESOURCE]: RESOURCES_MODULE_TITLE,
  [ModuleName.AI]: AI_MODULE_TITLE,
  [ModuleName.MOBILE_UI]: MOBILE_UI_MODULE_TITLE,
  [ModuleName.MOBILE_SCREENS]: MOBILE_VITALS_MODULE_TITLE,
  [ModuleName.SCREEN_RENDERING]: SCREEN_RENDERING_MODULE_TITLE,
  [ModuleName.CRONS]: CRONS_MODULE_TITLE,
  [ModuleName.UPTIME]: UPTIME_MODULE_TITLE,
  [ModuleName.OTHER]: '',
};

/**
 * These are overrides for the module titles for each domain view,
 * If a module is not listed here, it will use the default module title from MODULE_TITLES
 */
export const DOMAIN_VIEW_MODULE_TITLES: Record<
  DomainView,
  Partial<Record<ModuleName, string>>
> = {
  ai: {},
  backend: {},
  mobile: {
    [ModuleName.HTTP]: HTTP_MOBILE_MODULE_TITLE,
  },
  frontend: {
    [ModuleName.HTTP]: HTTP_FRONTEND_MODULE_TITLE,
  },
};
