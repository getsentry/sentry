import Feature from 'sentry/components/acl/feature';
import useOrganization from 'sentry/utils/useOrganization';
import ScreensTemplate from 'sentry/views/performance/mobile/components/screensTemplate';
import {ScreensView, YAxis} from 'sentry/views/performance/mobile/screenload/screens';
import {ROUTE_NAMES} from 'sentry/views/starfish/utils/routeNames';

export default function ResponsivenessModule() {
  const organization = useOrganization();

  return (
    <Feature
      features={['spans-first-ui', 'starfish-mobile-ui-module']}
      organization={organization}
    >
      <ScreensTemplate
        content={<ScreensView yAxes={[YAxis.SLOW_FRAME_RATE, YAxis.FROZEN_FRAME_RATE]} />}
        compatibilityProps={{
          compatibleSDKNames: ['sentry.cocoa', 'sentry.java.android'],
          docsUrl: 'www.docs.sentry.io', // TODO: Add real docs URL
        }}
        title={ROUTE_NAMES.mobileUI}
      />
    </Feature>
  );
}
