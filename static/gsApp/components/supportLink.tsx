import type {ComponentProps} from 'react';

import useOrganization from 'sentry/utils/useOrganization';

import IntercomLink from 'getsentry/components/intercomLink';
import ZendeskLink from 'getsentry/components/zendeskLink';

type Props = Omit<ComponentProps<typeof ZendeskLink>, 'organization'>;

/**
 * A support link that uses Intercom when the feature flag is enabled,
 * otherwise falls back to Zendesk.
 *
 * This wrapper allows instant switching between support providers via
 * the feature flag without code changes.
 */
function SupportLink(props: Props) {
  const organization = useOrganization();
  const useIntercom = organization.features.includes('intercom-support');

  if (useIntercom) {
    return <IntercomLink {...props} />;
  }

  return <ZendeskLink {...props} />;
}

export default SupportLink;
