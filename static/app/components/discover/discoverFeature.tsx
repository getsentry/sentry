import * as React from 'react';

import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import Hovercard from 'app/components/hovercard';
import {t} from 'app/locale';

type Props = {
  children: ({hasFeature: boolean}) => React.ReactNode;
};

/**
 * Provide a component that passes a prop to indicate if the current
 * organization doesn't have access to discover results.
 */
function DiscoverFeature({children}: Props) {
  const noFeatureMessage = t('Requires discover feature.');

  const renderDisabled = p => (
    <Hovercard
      body={
        <FeatureDisabled
          features={p.features}
          hideHelpToggle
          message={noFeatureMessage}
          featureName={noFeatureMessage}
        />
      }
    >
      {p.children(p)}
    </Hovercard>
  );

  return (
    <Feature
      hookName="feature-disabled:open-discover"
      features={['organizations:discover-basic']}
      renderDisabled={renderDisabled}
    >
      {({hasFeature}) => children({hasFeature})}
    </Feature>
  );
}

export default DiscoverFeature;
