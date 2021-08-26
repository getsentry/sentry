import * as React from 'react';
import * as qs from 'query-string';

import {platfromToIntegrationMap} from 'app/utils/integrationUtil';

import Platform from './platform';
import PlatformIntegrationSetup from './platformIntegrationSetup';

type Props = React.ComponentProps<typeof Platform> &
  Omit<React.ComponentProps<typeof PlatformIntegrationSetup>, 'integrationSlug'>;

const PlatformOrIntegration = (props: Props) => {
  const parsed = qs.parse(window.location.search);
  const {platform} = props.params;
  const integrationSlug = platform && platfromToIntegrationMap[platform];
  // check for manual override query param
  if (integrationSlug && parsed.manual !== '1') {
    return <PlatformIntegrationSetup integrationSlug={integrationSlug} {...props} />;
  }
  return <Platform {...props} />;
};

export default PlatformOrIntegration;
