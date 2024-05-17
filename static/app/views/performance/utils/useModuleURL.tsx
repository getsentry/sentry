import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {BASE_URL as AI_BASE_URL} from 'sentry/views/llmMonitoring/settings';
import {BASE_URL as RESOURCES_BASE_URL} from 'sentry/views/performance/browser/resources/settings';
import {BASE_URL as VITALS_BASE_URL} from 'sentry/views/performance/browser/webVitals/settings';
import {BASE_URL as CACHE_BASE_URL} from 'sentry/views/performance/cache/settings';
import {BASE_URL as DB_BASE_URL} from 'sentry/views/performance/database/settings';
import {BASE_URL as HTTP_BASE_URL} from 'sentry/views/performance/http/settings';
import {BASE_URL as APP_STARTS_BASE_URL} from 'sentry/views/performance/mobile/appStarts/settings';
import {BASE_URL as SCREEN_LOADS_BASE_URL} from 'sentry/views/performance/mobile/screenload/settings';
import {BASE_URL as MOBILE_UI_BASE_URL} from 'sentry/views/performance/mobile/ui/settings';
import {BASE_URL as QUEUE_BASE_URL} from 'sentry/views/performance/queues/settings';
import {INSIGHTS_BASE_URL} from 'sentry/views/performance/settings';
import {ModuleName} from 'sentry/views/starfish/types';

const MODULE_BASE_URLS: Record<ModuleName, string> = {
  [ModuleName.DB]: DB_BASE_URL,
  [ModuleName.HTTP]: HTTP_BASE_URL,
  [ModuleName.CACHE]: CACHE_BASE_URL,
  [ModuleName.QUEUE]: QUEUE_BASE_URL,
  [ModuleName.SCREEN_LOAD]: SCREEN_LOADS_BASE_URL,
  [ModuleName.APP_START]: APP_STARTS_BASE_URL,
  [ModuleName.VITAL]: VITALS_BASE_URL,
  [ModuleName.RESOURCE]: RESOURCES_BASE_URL,
  [ModuleName.AI]: AI_BASE_URL,
  [ModuleName.MOBILE_UI]: MOBILE_UI_BASE_URL,
  [ModuleName.OTHER]: '',
  [ModuleName.ALL]: '',
};

type ModuleNameStrings = `${ModuleName}`;
type RoutableModuleNames = Exclude<ModuleNameStrings, '' | 'other'>;

export const useModuleURL = (moduleName: RoutableModuleNames): string => {
  const {slug} = useOrganization();

  if (moduleName === ModuleName.AI) {
    // AI Doesn't live under "/performance"
    return normalizeUrl(`/organizations/${slug}${AI_BASE_URL}`);
  }

  return normalizeUrl(
    `/organizations/${slug}${INSIGHTS_BASE_URL}/${MODULE_BASE_URLS[moduleName]}`
  );
};
