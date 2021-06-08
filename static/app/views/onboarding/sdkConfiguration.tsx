import * as React from 'react';
import * as qs from 'query-string';

import {platfromToIntegrationMap} from 'app/utils/integrationUtil';

import DocumentationSetup from './documentationSetup';
import IntegrationSetup from './integrationSetup';
import OtherSetup from './otherSetup';

type Props = React.ComponentProps<typeof DocumentationSetup> &
  React.ComponentProps<typeof OtherSetup> &
  Omit<React.ComponentProps<typeof IntegrationSetup>, 'integrationSlug'>;

const SdkConfiguration = (props: Props) => {
  const parsed = qs.parse(window.location.search);
  const {platform} = props;
  const integrationSlug = platform && platfromToIntegrationMap[platform];
  // check for manual override query param
  if (integrationSlug && parsed.manual !== '1') {
    return <IntegrationSetup integrationSlug={integrationSlug} {...props} />;
  } else if (platform === 'other') {
    return <OtherSetup {...props} />;
  }
  return <DocumentationSetup {...props} />;
};

export default SdkConfiguration;
