import React from 'react';

import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import Button from 'app/components/button';
import Hovercard from 'app/components/hovercard';
import {t} from 'app/locale';

type Props = React.PropsWithChildren<{
  className?: string;
}> &
  React.ComponentProps<typeof Button>;

/**
 * Provide a button that turns itself off if the current organization
 * doesn't have access to discover results.
 */
function DiscoverButton({children, ...buttonProps}: Props) {
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
      {({hasFeature}) => (
        <Button disabled={!hasFeature} {...buttonProps}>
          {children}
        </Button>
      )}
    </Feature>
  );
}

export default DiscoverButton;
