import React from 'react';
import * as qs from 'query-string';

import {platfromToIntegrationMap} from 'app/utils/integrationUtil';

import ProjectSetup from './documentationSetup';
import IntegrationSetup from './integrationSetup';

type Props = React.ComponentProps<typeof ProjectSetup> &
  Omit<React.ComponentProps<typeof IntegrationSetup>, 'integrationSlug'>;

const SdkConfiguration = (props: Props) => {
  const parsed = qs.parse(window.location.search);
  const {platform} = props;
  const integrationSlug = platform && platfromToIntegrationMap[platform];
  // check for manual override query param
  if (integrationSlug && parsed.manual !== '1') {
    return <IntegrationSetup integrationSlug={integrationSlug} {...props} />;
  }
  return <ProjectSetup {...props} />;
};

export default SdkConfiguration;
