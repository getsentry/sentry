import React from 'react';

import {ExternalLink} from 'sentry/components/core/link';
import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';
import {activateZendesk, zendeskIsLoaded} from 'sentry/utils/zendesk';

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

class ZendeskLink extends React.Component<Props> {
  componentDidMount() {
    const {organization, source} = this.props;
    if (organization) {
      trackGetsentryAnalytics('zendesk_link.viewed', {organization, source});
    }
  }

  activateSupportWidget = (e: React.MouseEvent) => {
    const {organization, source} = this.props;

    if (zendeskIsLoaded()) {
      e.preventDefault();
      activateZendesk();
    }

    trackGetsentryAnalytics('zendesk_link.clicked', {organization, source});
  };

  render() {
    const {
      Component,
      subject,
      address,
      source: _source,
      organization: _organization,
      ...props
    } = this.props;

    let mailto = `mailto:${address ?? 'support'}@sentry.io`;
    if (subject) {
      mailto = `${mailto}?subject=${window.encodeURIComponent(subject)}`;
    }

    const LinkComponent = Component ?? ExternalLink;

    return (
      <LinkComponent href={mailto} onClick={this.activateSupportWidget} {...props}>
        {this.props.children}
      </LinkComponent>
    );
  }
}

export default withOrganization(ZendeskLink);
