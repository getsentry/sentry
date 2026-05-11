import React, {useEffect} from 'react';

import {ExternalLink} from '@sentry/scraps/link';

import {useOrganization} from 'sentry/utils/useOrganization';
import {activateZendesk, zendeskIsLoaded} from 'sentry/utils/zendesk';

import {trackGetsentryAnalytics} from 'getsentry/utils/trackGetsentryAnalytics';

type Props = {
  Component?: typeof ExternalLink;
  address?: string;
  children?: React.ReactNode;
  className?: string;
  source?: string;
  subject?: string;
};

export function ZendeskLink({
  source,
  Component,
  subject,
  address,
  children,
  ...props
}: Props) {
  const organization = useOrganization();
  useEffect(() => {
    if (organization) {
      trackGetsentryAnalytics('zendesk_link.viewed', {organization, source});
    }
  }, [organization, source]);

  async function activateSupportWidget(e: React.MouseEvent) {
    if (await zendeskIsLoaded()) {
      e.preventDefault();
      activateZendesk();
    }

    trackGetsentryAnalytics('zendesk_link.clicked', {organization, source});
  }

  let mailto = `mailto:${address ?? 'support'}@sentry.io`;
  if (subject) {
    mailto = `${mailto}?subject=${window.encodeURIComponent(subject)}`;
  }

  const LinkComponent = Component ?? ExternalLink;

  return (
    <LinkComponent href={mailto} onClick={activateSupportWidget} {...props}>
      {children}
    </LinkComponent>
  );
}
