import Feature from 'sentry/components/acl/feature';
import useOrganization from 'sentry/utils/useOrganization';
import AppStartup from 'sentry/views/performance/mobile/appStarts/screens';
import {StartTypeSelector} from 'sentry/views/performance/mobile/appStarts/screenSummary/startTypeSelector';
import ScreensTemplate from 'sentry/views/performance/mobile/components/screensTemplate';
import {ROUTE_NAMES} from 'sentry/views/starfish/utils/routeNames';

export default function InitializationModule() {
  const organization = useOrganization();

  return (
    <Feature features="spans-first-ui" organization={organization}>
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
    </Feature>
  );
}
