import * as qs from 'query-string';

import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import {platformToIntegrationMap} from 'sentry/utils/integrationUtil';

import GettingStarted from './gettingStarted';
import {ProjectInstallPlatform} from './platform';
import PlatformIntegrationSetup from './platformIntegrationSetup';

type Props = React.ComponentProps<typeof ProjectInstallPlatform> &
  Omit<React.ComponentProps<typeof PlatformIntegrationSetup>, 'integrationSlug'>;

function PlatformOrIntegration(props: Props) {
  const parsed = qs.parse(window.location.search);
  const {platform} = props.params;
  const integrationSlug = platform && platformToIntegrationMap[platform];
  // check for manual override query param
  // TODO(priscila): check this case
  if (integrationSlug && parsed.manual !== '1') {
    return <PlatformIntegrationSetup integrationSlug={integrationSlug} {...props} />;
  }
  return (
    <OnboardingContextProvider>
      <GettingStarted>
        <ProjectInstallPlatform {...props} />
      </GettingStarted>
    </OnboardingContextProvider>
  );
}

export default PlatformOrIntegration;
