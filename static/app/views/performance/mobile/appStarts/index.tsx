import AppStartup from 'sentry/views/performance/mobile/appStarts/screens';
import {StartTypeSelector} from 'sentry/views/performance/mobile/appStarts/screenSummary/startTypeSelector';
import ScreensTemplate from 'sentry/views/performance/mobile/components/screensTemplate';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {ROUTE_NAMES} from 'sentry/views/starfish/utils/routeNames';

export function InitializationModule() {
  return (
    <ScreensTemplate
      additionalSelectors={<StartTypeSelector />}
      compatibilityProps={{
        compatibleSDKNames: ['sentry.cocoa', 'sentry.java.android'],
        docsUrl:
          'https://docs.sentry.io/product/performance/mobile-vitals/app-starts/#minimum-sdk-requirements',
      }}
      content={<AppStartup chartHeight={200} />}
      title={ROUTE_NAMES['app-startup']}
    />
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders
      title={ROUTE_NAMES['app-startup']}
      baseURL="/performance/browser/app-startup"
      features="spans-first-ui"
    >
      <InitializationModule />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
