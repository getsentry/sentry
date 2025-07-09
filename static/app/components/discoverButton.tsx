import type {LinkButtonProps} from 'sentry/components/core/button/linkButton';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import DiscoverFeature from 'sentry/components/discover/discoverFeature';
import {t} from 'sentry/locale';

/**
 * Provide a button that turns itself off if the current organization
 * doesn't have access to discover results.
 */
function DiscoverButton(buttonProps: LinkButtonProps) {
  return (
    <DiscoverFeature>
      {({hasFeature}) => (
        <LinkButton
          disabled={!hasFeature} redesign redesign
          aria-label={t('Open in Discover')}
          {...buttonProps} redesign redesign
        />
      )}
    </DiscoverFeature>
  );
}

export default DiscoverButton;
