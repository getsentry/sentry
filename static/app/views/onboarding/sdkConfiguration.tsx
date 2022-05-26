import * as qs from 'query-string';

import {platformToIntegrationMap} from 'sentry/utils/integrationUtil';

import DocumentationSetup from './documentationSetup';
import IntegrationSetup from './integrationSetup';
import OtherSetup from './otherSetup';

type Props = React.ComponentProps<typeof DocumentationSetup> &
  React.ComponentProps<typeof OtherSetup> &
  Omit<React.ComponentProps<typeof IntegrationSetup>, 'integrationSlug'>;

const SdkConfiguration = (props: Props) => {
  const parsed = qs.parse(window.location.search);
  const {platform} = props;
  const integrationSlug = platform && platformToIntegrationMap[platform];
  // check for manual override query param
  if (integrationSlug && parsed.manual !== '1') {
    return <IntegrationSetup integrationSlug={integrationSlug} {...props} />;
  }
  if (platform === 'other') {
    return <OtherSetup {...props} />;
  }
  return <DocumentationSetup {...props} />;
};

export default SdkConfiguration;
