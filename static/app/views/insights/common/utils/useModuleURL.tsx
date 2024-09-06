import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {BASE_URL as RESOURCES_BASE_URL} from 'sentry/views/insights/browser/resources/settings';
import {BASE_URL as VITALS_BASE_URL} from 'sentry/views/insights/browser/webVitals/settings';
import {BASE_URL as CACHE_BASE_URL} from 'sentry/views/insights/cache/settings';
import {BASE_URL as DB_BASE_URL} from 'sentry/views/insights/database/settings';
import {BASE_URL as HTTP_BASE_URL} from 'sentry/views/insights/http/settings';
import {BASE_URL as AI_BASE_URL} from 'sentry/views/insights/llmMonitoring/settings';
import {BASE_URL as APP_STARTS_BASE_URL} from 'sentry/views/insights/mobile/appStarts/settings';
import {BASE_URL as SCREEN_LOADS_BASE_URL} from 'sentry/views/insights/mobile/screenload/settings';
import {BASE_URL as MOBILE_SCREENS_BASE_URL} from 'sentry/views/insights/mobile/screens/settings';
import {BASE_URL as MOBILE_UI_BASE_URL} from 'sentry/views/insights/mobile/ui/settings';
import {BASE_URL as QUEUE_BASE_URL} from 'sentry/views/insights/queues/settings';
import {INSIGHTS_BASE_URL} from 'sentry/views/insights/settings';
import {ModuleName} from 'sentry/views/insights/types';

export const MODULE_BASE_URLS: Record<ModuleName, string> = {
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
  [ModuleName.MOBILE_SCREENS]: MOBILE_SCREENS_BASE_URL,
  [ModuleName.OTHER]: '',
};

type ModuleNameStrings = `${ModuleName}`;
type RoutableModuleNames = Exclude<ModuleNameStrings, '' | 'other'>;

export const useModuleURL = (
  moduleName: RoutableModuleNames,
  bare: boolean = false
): string => {
  const builder = useModuleURLBuilder(bare);
  return builder(moduleName);
};

type URLBuilder = (moduleName: RoutableModuleNames) => string;

export function useModuleURLBuilder(bare: boolean = false): URLBuilder {
  const organization = useOrganization({allowNull: true}); // Some parts of the app, like the main sidebar, render even if the organization isn't available (during loading, or at all).

  if (!organization) {
    // If there isn't an organization, items that link to modules won't be visible, so this is a fallback just-in-case, and isn't trying too hard to be useful
    return () => '';
  }

  const {slug} = organization;

  return function (moduleName: RoutableModuleNames) {
    return bare
      ? `${INSIGHTS_BASE_URL}/${MODULE_BASE_URLS[moduleName]}`
      : normalizeUrl(
          `/organizations/${slug}/${INSIGHTS_BASE_URL}/${MODULE_BASE_URLS[moduleName]}`
        );
  };
}
