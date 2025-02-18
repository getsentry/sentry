import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {BASE_URL as RESOURCES_BASE_URL} from 'sentry/views/insights/browser/resources/settings';
import {BASE_URL as VITALS_BASE_URL} from 'sentry/views/insights/browser/webVitals/settings';
import {BASE_URL as CACHE_BASE_URL} from 'sentry/views/insights/cache/settings';
import {BASE_URL as CRONS_BASE_URL} from 'sentry/views/insights/crons/settings';
import {BASE_URL as DB_BASE_URL} from 'sentry/views/insights/database/settings';
import {BASE_URL as HTTP_BASE_URL} from 'sentry/views/insights/http/settings';
import {BASE_URL as AI_BASE_URL} from 'sentry/views/insights/llmMonitoring/settings';
import {BASE_URL as APP_STARTS_BASE_URL} from 'sentry/views/insights/mobile/appStarts/settings';
import {BASE_URL as SCREEN_LOADS_BASE_URL} from 'sentry/views/insights/mobile/screenload/settings';
import {BASE_URL as SCREEN_RENDERING_BASE_URL} from 'sentry/views/insights/mobile/screenRendering/settings';
import {BASE_URL as MOBILE_SCREENS_BASE_URL} from 'sentry/views/insights/mobile/screens/settings';
import {BASE_URL as MOBILE_UI_BASE_URL} from 'sentry/views/insights/mobile/ui/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';
import {
  type DomainView,
  useDomainViewFilters,
} from 'sentry/views/insights/pages/useFilters';
import {getModuleView} from 'sentry/views/insights/pages/utils';
import {BASE_URL as QUEUE_BASE_URL} from 'sentry/views/insights/queues/settings';
import {BASE_URL as SESSIONS_BASE_URL} from 'sentry/views/insights/sessions/settings';
import {ModuleName} from 'sentry/views/insights/types';
import {BASE_URL as UPTIME_BASE_URL} from 'sentry/views/insights/uptime/settings';

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
  [ModuleName.MOBILE_VITALS]: MOBILE_SCREENS_BASE_URL,
  [ModuleName.SCREEN_RENDERING]: SCREEN_RENDERING_BASE_URL,
  [ModuleName.CRONS]: CRONS_BASE_URL,
  [ModuleName.UPTIME]: UPTIME_BASE_URL,
  [ModuleName.SESSIONS]: SESSIONS_BASE_URL,
  [ModuleName.OTHER]: '',
};

type ModuleNameStrings = `${ModuleName}`;
export type RoutableModuleNames = Exclude<ModuleNameStrings, '' | 'other'>;

export const useModuleURL = (
  moduleName: RoutableModuleNames,
  bare = false,
  view?: DomainView // Todo - this should be required when a module belongs to multiple views
): string => {
  const builder = useModuleURLBuilder(bare);
  return builder(moduleName, view);
};

export type URLBuilder = (
  moduleName: RoutableModuleNames,
  domainView?: DomainView
) => string;

/**
 *  This hook returns a function to build URLs for the module summary pages.
 *  This function will return the domain specific module url, the domain is determined in the following order of priority:
 *    1. The domain view passed in by the user
 *    2. (when detectDomainView=true) The current domain view (i.e if the current url is `/performance/frontend`, the current view is frontned)
 *    3. The default view for the module
 */
export function useModuleURLBuilder(bare = false, detectDomainView = true): URLBuilder {
  const organization = useOrganization({allowNull: true}); // Some parts of the app, like the main sidebar, render even if the organization isn't available (during loading, or at all).
  const {view: currentView} = useDomainViewFilters();

  if (!organization) {
    // If there isn't an organization, items that link to modules won't be visible, so this is a fallback just-in-case, and isn't trying too hard to be useful
    return () => '';
  }

  const {slug} = organization;

  return function (moduleName: RoutableModuleNames, domainView?: DomainView) {
    let view = detectDomainView ? currentView : currentView ?? domainView;

    if (!view) {
      view = getModuleView(moduleName as ModuleName);
    }

    return bare
      ? `${DOMAIN_VIEW_BASE_URL}/${view}/${MODULE_BASE_URLS[moduleName]}`
      : normalizeUrl(
          `/organizations/${slug}/${DOMAIN_VIEW_BASE_URL}/${view}/${MODULE_BASE_URLS[moduleName]}`
        );
  };
}
