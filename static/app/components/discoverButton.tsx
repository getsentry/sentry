import type {LinkButtonProps} from '@sentry/scraps/button';
import {LinkButton} from '@sentry/scraps/button';

import {DiscoverFeature} from 'sentry/components/discover/discoverFeature';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getDiscoverDeprecation} from 'sentry/views/discover/utils';

/**
 * Provide a button that turns itself off if the current organization
 * doesn't have access to discover results.
 */
export function DiscoverButton(buttonProps: LinkButtonProps) {
  const organization = useOrganization();
  return (
    <DiscoverFeature>
      {({hasFeature}) => (
        <LinkButton
          disabled={!hasFeature}
          aria-label={
            getDiscoverDeprecation(organization)
              ? t('Open in Explore')
              : t('Open in Discover')
          }
          {...buttonProps}
        />
      )}
    </DiscoverFeature>
  );
}
