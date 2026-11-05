import type {LinkButtonProps} from '@sentry/scraps/button';
import {LinkButton} from '@sentry/scraps/button';

import {t} from 'sentry/locale';

import {DiscoverFeature} from './discover/discoverFeature';

/**
 * Provide a button that turns itself off if the current organization
 * doesn't have access to discover results.
 */
export function DiscoverButton(buttonProps: LinkButtonProps) {
  return (
    <DiscoverFeature>
      {({hasFeature}) => (
        <LinkButton
          disabled={!hasFeature}
          aria-label={t('Open in Explore')}
          {...buttonProps}
        />
      )}
    </DiscoverFeature>
  );
}
