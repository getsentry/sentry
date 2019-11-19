import React from 'react';
import styled from 'react-emotion';
import {Location} from 'history';

import {t} from 'app/locale';
import {Event, Organization} from 'app/types';
import PageHeading from 'app/components/pageHeading';
import BetaTag from 'app/components/betaTag';
import Link from 'app/components/links/link';
import InlineSvg from 'app/components/inlineSvg';

import EventView from './eventView';

type Props = {
  eventView: EventView;
  event: Event | undefined;
  organization: Organization;
  location: Location;
};
class DiscoverBreadcrumb extends React.Component<Props> {
  static defaultProps = {
    event: undefined,
  };

  getCrumbs(): React.ReactNode {
    const {eventView, event, organization} = this.props;
    const crumbs: React.ReactNode[] = [];

    if (eventView && eventView.isValid()) {
      const target = {
        pathname: `/organizations/${organization.slug}/eventsv2/`,
        query: eventView.generateQueryStringObject(),
      };

      crumbs.push(
        <span key="eventview-sep">
          <InlineSvg height="20px" width="20px" src="icon-chevron-right" />
        </span>
      );
      crumbs.push(
        <CrumbLink to={target} key="eventview-link">
          {eventView.name}
        </CrumbLink>
      );
    }

    if (event) {
      crumbs.push(
        <span key="event-sep">
          <InlineSvg height="20px" width="20px" src="icon-chevron-right" />
        </span>
      );
      crumbs.push(<span key="event-name">{t('Event Detail')}</span>);
    }

    return crumbs;
  }

  render() {
    const {organization, location, eventView} = this.props;

    const target = {
      pathname: `/organizations/${organization.slug}/eventsv2/`,
      query: {
        ...location.query,
        ...eventView.generateBlankQueryStringObject(),
        ...eventView.getGlobalSelection(),
      },
    };

    return (
      <PageHeading>
        <CrumbLink to={target}>{t('Discover')}</CrumbLink>
        <BetaTagWrapper>
          <BetaTag />
        </BetaTagWrapper>
        {this.getCrumbs()}
      </PageHeading>
    );
  }
}

const BetaTagWrapper = styled('span')`
  margin-right: 0.4em;
`;

const CrumbLink = styled(Link)`
  color: ${p => p.theme.gray2};
  &:hover {
    color: ${p => p.theme.gray2};
  }
`;

export default DiscoverBreadcrumb;
