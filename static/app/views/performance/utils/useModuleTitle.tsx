import {MODULE_TITLE as AI_MODULE_TITLE} from 'sentry/views/llmMonitoring/settings';
import {MODULE_TITLE as RESOURCES_MODULE_TITLE} from 'sentry/views/performance/browser/resources/settings';
import {MODULE_TITLE as VITALS_MODULE_TITLE} from 'sentry/views/performance/browser/webVitals/settings';
import {MODULE_TITLE as CACHE_MODULE_TITLE} from 'sentry/views/performance/cache/settings';
import {MODULE_TITLE as DB_MODULE_TITLE} from 'sentry/views/performance/database/settings';
import {MODULE_TITLE as HTTP_MODULE_TITLE} from 'sentry/views/performance/http/settings';
import {MODULE_TITLE as APP_STARTS_MODULE_TITLE} from 'sentry/views/performance/mobile/appStarts/settings';
import {MODULE_TITLE as SCREEN_LOADS_MODULE_TITLE} from 'sentry/views/performance/mobile/screenload/settings';
import {MODULE_TITLE as MOBILE_UI_MODULE_TITLE} from 'sentry/views/performance/mobile/ui/settings';
import {MODULE_TITLE as QUEUE_MODULE_TITLE} from 'sentry/views/performance/queues/settings';
import {ModuleName} from 'sentry/views/starfish/types';

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
  [ModuleName.OTHER]: '',
  [ModuleName.ALL]: '',
};

type ModuleNameStrings = `${ModuleName}`;
type TitleableModuleNames = Exclude<ModuleNameStrings, '' | 'other'>;

export function useModuleTitle(moduleName: TitleableModuleNames) {
  return MODULE_TITLES[moduleName];
}
