import AppStartup from 'sentry/views/performance/mobile/appStarts/screens';
import {StartTypeSelector} from 'sentry/views/performance/mobile/appStarts/screenSummary/startTypeSelector';
import {BASE_URL} from 'sentry/views/performance/mobile/appStarts/settings';
import ScreensTemplate from 'sentry/views/performance/mobile/components/screensTemplate';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {ROUTE_NAMES} from 'sentry/views/starfish/utils/routeNames';

export function InitializationModule() {
  return (
    <ScreensTemplate
      additionalSelectors={<StartTypeSelector />}
      content={<AppStartup chartHeight={200} />}
      title={ROUTE_NAMES['app-startup']}
    />
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders
      title={ROUTE_NAMES['app-startup']}
      baseURL={`/performance/${BASE_URL}`}
      features="spans-first-ui"
    >
      <InitializationModule />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
