import * as React from 'react';

import Button, {ButtonProps} from 'sentry/components/button';
import DiscoverFeature from 'sentry/components/discover/discoverFeature';
import {t} from 'sentry/locale';

type DiscoverButtonProps = Omit<ButtonProps, 'aria-label'>;

/**
 * Provide a button that turns itself off if the current organization
 * doesn't have access to discover results.
 */
function DiscoverButton({children, ...buttonProps}: DiscoverButtonProps) {
  return (
    <DiscoverFeature>
      {({hasFeature}) => (
        <Button
          disabled={!hasFeature}
          aria-label={t('Open in Discover')}
          {...buttonProps}
        >
          {children}
        </Button>
      )}
    </DiscoverFeature>
  );
}

export default DiscoverButton;
