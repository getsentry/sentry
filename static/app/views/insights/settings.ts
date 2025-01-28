import {t} from 'sentry/locale';
import {
  DATA_TYPE as RESOURCE_DATA_TYPE,
  DATA_TYPE_PLURAL as RESOURCE_DATA_TYPE_PLURAL,
  MODULE_DOC_LINK as RESOURCES_MODULE_DOC_LINK,
  MODULE_FEATURES as RESOURCE_MODULE_FEATURES,
  MODULE_TITLE as RESOURCES_MODULE_TITLE,
} from 'sentry/views/insights/browser/resources/settings';
import {
  DATA_TYPE as WEB_VITALS_DATA_TYPE,
  DATA_TYPE_PLURAL as WEB_VITALS_DATA_TYPE_PLURAL,
  MODULE_DOC_LINK as VITALS_MODULE_DOC_LINK,
  MODULE_FEATURES as VITALS_MODULE_FEATURES,
  MODULE_TITLE as VITALS_MODULE_TITLE,
} from 'sentry/views/insights/browser/webVitals/settings';
import {
  DATA_TYPE as CACHE_DATA_TYPE,
  DATA_TYPE_PLURAL as CACHE_DATA_TYPE_PLURAL,
  MODULE_DOC_LINK as CACHE_MODULE_DOC_LINK,
  MODULE_FEATURES as CACHE_MODULE_FEATURES,
  MODULE_TITLE as CACHE_MODULE_TITLE,
} from 'sentry/views/insights/cache/settings';
import {
  DATA_TYPE as CRONS_DATA_TYPE,
  DATA_TYPE_PLURAL as CRONS_DATA_TYPE_PLURAL,
  MODULE_DOC_LINK as CRONS_MODULE_DOC_LINK,
  MODULE_FEATURES as CRONS_MODULE_FEATURES,
  MODULE_TITLE as CRONS_MODULE_TITLE,
  MODULE_VISIBLE_FEATURES as CRONS_MODULE_VISIBLE_FEATURES,
} from 'sentry/views/insights/crons/settings';
import {
  DATA_TYPE as DB_DATA_TYPE,
  DATA_TYPE_PLURAL as DB_DATA_TYPE_PLURAL,
  MODULE_DOC_LINK as DB_MODULE_DOC_LINK,
  MODULE_FEATURES as DB_MODULE_FEATURES,
  MODULE_TITLE as DB_MODULE_TITLE,
} from 'sentry/views/insights/database/settings';
import {
  DATA_TYPE as HTTP_DATA_TYPE,
  DATA_TYPE_PLURAL as HTTP_DATA_TYPE_PLURAL,
  MODULE_DOC_LINK as HTTP_MODULE_DOC_LINK,
  MODULE_FEATURES as HTTP_MODULE_FEATURES,
  MODULE_TITLE as HTTP_MODULE_TITLE,
} from 'sentry/views/insights/http/settings';
import {
  DATA_TYPE as AI_DATA_TYPE,
  DATA_TYPE_PLURAL as AI_DATA_TYPE_PLURAL,
  MODULE_DOC_LINK as AI_MODULE_DOC_LINK,
  MODULE_FEATURES as AI_MODULE_FEATURES,
  MODULE_TITLE as AI_MODULE_TITLE,
} from 'sentry/views/insights/llmMonitoring/settings';
import {
  DATA_TYPE as APP_STARTS_DATA_TYPE,
  DATA_TYPE_PLURAL as APP_STARTS_DATA_TYPE_PLURAL,
  MODULE_DOC_LINK as APP_STARTS_MODULE_DOC_LINK,
  MODULE_FEATURES as APP_STARTS_MODULE_FEATURES,
  MODULE_TITLE as APP_STARTS_MODULE_TITLE,
} from 'sentry/views/insights/mobile/appStarts/settings';
import {
  DATA_TYPE as SCREEN_LOAD_DATA_TYPE,
  DATA_TYPE_PLURAL as SCREEN_LOAD_DATA_TYPE_PLURAL,
  MODULE_DOC_LINK as SCREEN_LOADS_MODULE_DOC_LINK,
  MODULE_FEATURES as SCREEN_LOADS_MODULE_FEATURES,
  MODULE_TITLE as SCREEN_LOADS_MODULE_TITLE,
} from 'sentry/views/insights/mobile/screenload/settings';
import {
  DATA_TYPE as SCREEN_RENDERING_DATA_TYPE,
  DATA_TYPE_PLURAL as SCREEN_RENDERING_DATA_TYPE_PLURAL,
  MODULE_DOC_LINK as SCREEN_RENDERING_MODULE_DOC_LINK,
  MODULE_FEATURES as SCREEN_RENDERING_MODULE_FEATURES,
  MODULE_TITLE as SCREEN_RENDERING_MODULE_TITLE,
} from 'sentry/views/insights/mobile/screenRendering/settings';
import {
  DATA_TYPE as MOBILE_SCREENS_DATA_TYPE,
  DATA_TYPE_PLURAL as MOBILE_SCREENS_DATA_TYPE_PLURAL,
  MODULE_DOC_LINK as MODULE_SCREENS_DOC_LINK,
  MODULE_FEATURE as MOBILE_SCREENS_MODULE_FEATURE,
  MODULE_TITLE as MOBILE_SCREENS_MODULE_TITLE,
} from 'sentry/views/insights/mobile/screens/settings';
import {
  MODULE_DOC_LINK as MODULE_UI_DOC_LINK,
  MODULE_FEATURES as MOBILE_UI_MODULE_FEATURES,
  MODULE_TITLE as MOBILE_UI_MODULE_TITLE,
} from 'sentry/views/insights/mobile/ui/settings';
import {
  DATA_TYPE as QUEUE_DATA_TYPE,
  DATA_TYPE_PLURAL as QUEUE_DATA_TYPE_PLURAL,
  MODULE_DOC_LINK as QUEUE_MODULE_DOC_LINK,
  MODULE_FEATURES as QUEUE_MODULE_FEATURES,
  MODULE_TITLE as QUEUE_MODULE_TITLE,
} from 'sentry/views/insights/queues/settings';
import {
  DATA_TYPE as UPTIME_DATA_TYPE,
  DATA_TYPE_PLURAL as UPTIME_DATA_TYPE_PLURAL,
  MODULE_DOC_LINK as UPTIME_MODULE_DOC_LINK,
  MODULE_FEATURES as UPTIME_MODULE_FEATURES,
  MODULE_TITLE as UPTIME_MODULE_TITLE,
  MODULE_VISIBLE_FEATURES as UPTIME_MODULE_VISIBLE_FEATURES,
} from 'sentry/views/insights/uptime/settings';

import {ModuleName} from './types';

export const INSIGHTS_TITLE = t('Insights');
export const INSIGHTS_BASE_URL = 'insights';

export const DEFAULT_INTERVAL = '10m';

export const QUERY_DATE_RANGE_LIMIT = 7; // Maximum number of days that can be queried for, enabled by the `insights-query-date-range-limit` feature flag

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
  [ModuleName.MOBILE_SCREENS]: MOBILE_SCREENS_MODULE_TITLE,
  [ModuleName.SCREEN_RENDERING]: SCREEN_RENDERING_MODULE_TITLE,
  [ModuleName.UPTIME]: UPTIME_MODULE_TITLE,
  [ModuleName.CRONS]: CRONS_MODULE_TITLE,
  [ModuleName.OTHER]: '',
};

export const MODULE_DATA_TYPES: Record<ModuleName, string> = {
  [ModuleName.DB]: DB_DATA_TYPE,
  [ModuleName.HTTP]: HTTP_DATA_TYPE,
  [ModuleName.CACHE]: CACHE_DATA_TYPE,
  [ModuleName.QUEUE]: QUEUE_DATA_TYPE,
  [ModuleName.SCREEN_LOAD]: SCREEN_LOAD_DATA_TYPE,
  [ModuleName.APP_START]: APP_STARTS_DATA_TYPE,
  [ModuleName.VITAL]: WEB_VITALS_DATA_TYPE,
  [ModuleName.RESOURCE]: RESOURCE_DATA_TYPE,
  [ModuleName.AI]: AI_DATA_TYPE,
  [ModuleName.MOBILE_UI]: t('Mobile UI'),
  [ModuleName.MOBILE_SCREENS]: MOBILE_SCREENS_DATA_TYPE,
  [ModuleName.SCREEN_RENDERING]: SCREEN_RENDERING_DATA_TYPE,
  [ModuleName.UPTIME]: UPTIME_DATA_TYPE,
  [ModuleName.CRONS]: CRONS_DATA_TYPE,
  [ModuleName.OTHER]: '',
};

export const MODULE_DATA_TYPES_PLURAL: Record<ModuleName, string> = {
  [ModuleName.DB]: DB_DATA_TYPE_PLURAL,
  [ModuleName.HTTP]: HTTP_DATA_TYPE_PLURAL,
  [ModuleName.CACHE]: CACHE_DATA_TYPE_PLURAL,
  [ModuleName.QUEUE]: QUEUE_DATA_TYPE_PLURAL,
  [ModuleName.SCREEN_LOAD]: SCREEN_LOAD_DATA_TYPE_PLURAL,
  [ModuleName.APP_START]: APP_STARTS_DATA_TYPE_PLURAL,
  [ModuleName.VITAL]: WEB_VITALS_DATA_TYPE_PLURAL,
  [ModuleName.RESOURCE]: RESOURCE_DATA_TYPE_PLURAL,
  [ModuleName.AI]: AI_DATA_TYPE_PLURAL,
  [ModuleName.MOBILE_UI]: t('Mobile UI'),
  [ModuleName.MOBILE_SCREENS]: MOBILE_SCREENS_DATA_TYPE_PLURAL,
  [ModuleName.SCREEN_RENDERING]: SCREEN_RENDERING_DATA_TYPE_PLURAL,
  [ModuleName.UPTIME]: UPTIME_DATA_TYPE_PLURAL,
  [ModuleName.CRONS]: CRONS_DATA_TYPE_PLURAL,
  [ModuleName.OTHER]: '',
};

export const MODULE_PRODUCT_DOC_LINKS: Record<ModuleName, string> = {
  [ModuleName.DB]: DB_MODULE_DOC_LINK,
  [ModuleName.HTTP]: HTTP_MODULE_DOC_LINK,
  [ModuleName.CACHE]: CACHE_MODULE_DOC_LINK,
  [ModuleName.QUEUE]: QUEUE_MODULE_DOC_LINK,
  [ModuleName.SCREEN_LOAD]: SCREEN_LOADS_MODULE_DOC_LINK,
  [ModuleName.APP_START]: APP_STARTS_MODULE_DOC_LINK,
  [ModuleName.VITAL]: VITALS_MODULE_DOC_LINK,
  [ModuleName.RESOURCE]: RESOURCES_MODULE_DOC_LINK,
  [ModuleName.AI]: AI_MODULE_DOC_LINK,
  [ModuleName.MOBILE_UI]: MODULE_UI_DOC_LINK,
  [ModuleName.MOBILE_SCREENS]: MODULE_SCREENS_DOC_LINK,
  [ModuleName.SCREEN_RENDERING]: SCREEN_RENDERING_MODULE_DOC_LINK,
  [ModuleName.UPTIME]: UPTIME_MODULE_DOC_LINK,
  [ModuleName.CRONS]: CRONS_MODULE_DOC_LINK,
  [ModuleName.OTHER]: '',
};

/**
 * Features that control gating of modules, falling back to upsell style hooks.
 */
export const MODULE_FEATURE_MAP: Record<ModuleName, string[]> = {
  [ModuleName.DB]: DB_MODULE_FEATURES,
  [ModuleName.APP_START]: APP_STARTS_MODULE_FEATURES,
  [ModuleName.HTTP]: HTTP_MODULE_FEATURES,
  [ModuleName.RESOURCE]: RESOURCE_MODULE_FEATURES,
  [ModuleName.VITAL]: VITALS_MODULE_FEATURES,
  [ModuleName.CACHE]: CACHE_MODULE_FEATURES,
  [ModuleName.QUEUE]: QUEUE_MODULE_FEATURES,
  [ModuleName.AI]: AI_MODULE_FEATURES,
  [ModuleName.SCREEN_LOAD]: SCREEN_LOADS_MODULE_FEATURES,
  [ModuleName.MOBILE_UI]: MOBILE_UI_MODULE_FEATURES,
  [ModuleName.MOBILE_SCREENS]: [MOBILE_SCREENS_MODULE_FEATURE],
  [ModuleName.SCREEN_RENDERING]: SCREEN_RENDERING_MODULE_FEATURES,
  [ModuleName.UPTIME]: UPTIME_MODULE_FEATURES,
  [ModuleName.CRONS]: CRONS_MODULE_FEATURES,
  [ModuleName.OTHER]: [],
};

/**
 * Features that control the visibility of modules.
 */
export const MODULE_FEATURE_VISIBLE_MAP: Record<ModuleName, string[]> = {
  [ModuleName.DB]: ['insights-entry-points'],
  [ModuleName.APP_START]: ['insights-entry-points'],
  [ModuleName.HTTP]: ['insights-entry-points'],
  [ModuleName.RESOURCE]: ['insights-entry-points'],
  [ModuleName.VITAL]: ['insights-entry-points'],
  [ModuleName.CACHE]: ['insights-entry-points'],
  [ModuleName.QUEUE]: ['insights-entry-points'],
  [ModuleName.AI]: ['insights-entry-points'],
  [ModuleName.SCREEN_LOAD]: ['insights-entry-points'],
  [ModuleName.MOBILE_UI]: ['insights-entry-points'],
  [ModuleName.MOBILE_SCREENS]: ['insights-entry-points'],
  [ModuleName.SCREEN_RENDERING]: ['insights-entry-points'],
  [ModuleName.UPTIME]: ['insights-entry-points', ...UPTIME_MODULE_VISIBLE_FEATURES],
  [ModuleName.CRONS]: ['insights-entry-points', ...CRONS_MODULE_VISIBLE_FEATURES],
  [ModuleName.OTHER]: ['insights-entry-points'],
};
