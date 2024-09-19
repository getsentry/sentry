import ResourcesLandingPage from 'sentry/views/insights/browser/resources/views/resourcesLandingPage';
import ResourceSummaryPage from 'sentry/views/insights/browser/resources/views/resourceSummaryPage';
import PageOverview from 'sentry/views/insights/browser/webVitals/views/pageOverview';
import WebVitalsLandingPage from 'sentry/views/insights/browser/webVitals/views/webVitalsLandingPage';
import CachesLandingPage from 'sentry/views/insights/cache/views/cacheLandingPage';
import DatabaseLandingPage from 'sentry/views/insights/database/views//databaseLandingPage';
import HTTPDomainSummaryPage from 'sentry/views/insights/http/views/httpDomainSummaryPage';
import HTTPLandingPage from 'sentry/views/insights/http/views/httpLandingPage';
import LLMLandingPage from 'sentry/views/insights/llmMonitoring/views/llmMonitoringLandingPage';
import AppStartsLandingPage from 'sentry/views/insights/mobile/appStarts/views/appStartsLandingPage';
import ScreenLoadLandingPage from 'sentry/views/insights/mobile/screenload/views/screenloadLandingPage';
import ScreensLandingPage from 'sentry/views/insights/mobile/screens/views/screensLandingPage';
import MobileUiLandingPage from 'sentry/views/insights/mobile/ui/views/uiLandingPage';
import {useFilters} from 'sentry/views/insights/pages/useFilters';
import QueuesLandingPage from 'sentry/views/insights/queues/views/queuesLandingPage';
import {type InsightLandingProps, ModuleName} from 'sentry/views/insights/types';

export function ModuleRenderer() {
  const {module, hasSubpage} = useFilters();

  const landingProps: InsightLandingProps = {disableHeader: true};

  const ModuleSubPage = hasSubpage && ModuleSubpages[module || ''];
  const ModuleLandingPage = ModuleNameToComponent[module || ''];

  if (ModuleSubPage) {
    return <ModuleSubPage {...landingProps} />;
  }

  if (ModuleLandingPage) {
    return <ModuleLandingPage {...landingProps} />;
  }
  return null;
}

const ModuleNameToComponent: Record<ModuleName, React.ComponentType> = {
  [ModuleName.DB]: DatabaseLandingPage,
  [ModuleName.HTTP]: HTTPLandingPage,
  [ModuleName.CACHE]: CachesLandingPage,
  [ModuleName.QUEUE]: QueuesLandingPage,
  [ModuleName.AI]: LLMLandingPage,
  [ModuleName.RESOURCE]: ResourcesLandingPage,
  [ModuleName.VITAL]: WebVitalsLandingPage,
  [ModuleName.MOBILE_UI]: MobileUiLandingPage,
  [ModuleName.SCREEN_LOAD]: ScreenLoadLandingPage,
  [ModuleName.MOBILE_SCREENS]: ScreensLandingPage,
  [ModuleName.APP_START]: AppStartsLandingPage,
  [ModuleName.OTHER]: () => null,
};

const ModuleSubpages: Partial<Record<ModuleName, React.ComponentType>> = {
  [ModuleName.RESOURCE]: ResourceSummaryPage,
  [ModuleName.HTTP]: HTTPDomainSummaryPage,
  [ModuleName.VITAL]: PageOverview,
};
