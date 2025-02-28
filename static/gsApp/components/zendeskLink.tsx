import {Component} from 'react';

import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';

import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

type AnchorProps = {
  href: string;
  onClick: (e: React.MouseEvent) => void;
};

type Props = {
  organization: Organization;
  Component?: React.ComponentType<AnchorProps>;
  address?: string;
  children?: React.ReactNode;
  className?: string;
  source?: string;
  subject?: string;
};

class ZendeskLink extends Component<Props> {
  componentDidMount() {
    const {organization, source} = this.props;
    if (organization) {
      trackGetsentryAnalytics('zendesk_link.viewed', {organization, source});
    }
  }

  activateSupportWidget = (e: React.MouseEvent) => {
    const {organization, source} = this.props;

    if (window.zE && typeof window.zE.activate === 'function') {
      e.preventDefault();
      window.zE.activate({hideOnClose: true});
    }

    trackGetsentryAnalytics('zendesk_link.clicked', {organization, source});
  };

  render() {
    const {
      Component: LinkComponent,
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

    const Link = LinkComponent ?? 'a';

    return (
      <Link href={mailto} onClick={this.activateSupportWidget} {...props}>
        {this.props.children}
      </Link>
    );
  }
}

export default withOrganization(ZendeskLink);
