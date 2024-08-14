import {MODULE_TITLE as RESOURCES_MODULE_TITLE} from 'sentry/views/insights/browser/resources/settings';
import {MODULE_TITLE as VITALS_MODULE_TITLE} from 'sentry/views/insights/browser/webVitals/settings';
import {MODULE_TITLE as CACHE_MODULE_TITLE} from 'sentry/views/insights/cache/settings';
import {MODULE_TITLE as DB_MODULE_TITLE} from 'sentry/views/insights/database/settings';
import {MODULE_TITLE as HTTP_MODULE_TITLE} from 'sentry/views/insights/http/settings';
import {MODULE_TITLE as AI_MODULE_TITLE} from 'sentry/views/insights/llmMonitoring/settings';
import {MODULE_TITLE as APP_STARTS_MODULE_TITLE} from 'sentry/views/insights/mobile/appStarts/settings';
import {MODULE_TITLE as SCREEN_LOADS_MODULE_TITLE} from 'sentry/views/insights/mobile/screenload/settings';
import {MODULE_TITLE as MOBILE_VITALS_MODULE_TITLE} from 'sentry/views/insights/mobile/screens/settings';
import {MODULE_TITLE as MOBILE_UI_MODULE_TITLE} from 'sentry/views/insights/mobile/ui/settings';
import {MODULE_TITLE as QUEUE_MODULE_TITLE} from 'sentry/views/insights/queues/settings';
import {ModuleName} from 'sentry/views/insights/types';

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
  [ModuleName.OTHER]: '',
};
