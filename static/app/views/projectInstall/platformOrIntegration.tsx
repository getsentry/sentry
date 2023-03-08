import * as qs from 'query-string';

import {platformToIntegrationMap} from 'sentry/utils/integrationUtil';

import {ProjectInstallPlatform} from './platform';
import PlatformIntegrationSetup from './platformIntegrationSetup';

type Props = React.ComponentProps<typeof ProjectInstallPlatform> &
  Omit<React.ComponentProps<typeof PlatformIntegrationSetup>, 'integrationSlug'>;

const PlatformOrIntegration = (props: Props) => {
  const parsed = qs.parse(window.location.search);
  const {platform} = props.params;
  const integrationSlug = platform && platformToIntegrationMap[platform];
  // check for manual override query param
  if (integrationSlug && parsed.manual !== '1') {
    return <PlatformIntegrationSetup integrationSlug={integrationSlug} {...props} />;
  }
  return <ProjectInstallPlatform {...props} />;
};

export default PlatformOrIntegration;
