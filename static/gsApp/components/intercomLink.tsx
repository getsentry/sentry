import {useEffect} from 'react';

import {ExternalLink} from '@sentry/scraps/link';

import type {Organization} from 'sentry/types/organization';
import {intercomIsLoaded, showIntercom} from 'sentry/utils/intercom';
import withOrganization from 'sentry/utils/withOrganization';

import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

type Props = {
  organization: Organization;
  Component?: typeof ExternalLink;
  address?: string;
  children?: React.ReactNode;
  className?: string;
  source?: string;
  subject?: string;
};

function IntercomLink({
  organization,
  source,
  Component,
  subject,
  address,
  children,
  ...props
}: Props) {
  useEffect(() => {
    if (organization) {
      trackGetsentryAnalytics('intercom_link.viewed', {organization, source});
    }
  }, [organization, source]);

  function activateSupportWidget(e: React.MouseEvent) {
    if (intercomIsLoaded()) {
      e.preventDefault();
      showIntercom();
    }

    trackGetsentryAnalytics('intercom_link.clicked', {organization, source});
  }

  // Fallback to mailto if Intercom is blocked
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

export default withOrganization(IntercomLink);
