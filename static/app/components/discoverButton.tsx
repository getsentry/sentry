import * as React from 'react';

import Button from 'app/components/button';
import DiscoverFeature from 'app/components/discover/discoverFeature';

type Props = React.PropsWithChildren<{
  className?: string;
}> &
  React.ComponentProps<typeof Button>;

/**
 * Provide a button that turns itself off if the current organization
 * doesn't have access to discover results.
 */
function DiscoverButton({children, ...buttonProps}: Props) {
  return (
    <DiscoverFeature>
      {({hasFeature}) => (
        <Button disabled={!hasFeature} {...buttonProps}>
          {children}
        </Button>
      )}
    </DiscoverFeature>
  );
}

export default DiscoverButton;
