import React from 'react';
import styled from 'react-emotion';
import {Location} from 'history';

import {t} from 'app/locale';
import {Event, Organization} from 'app/types';
import BetaTag from 'app/components/betaTag';
import Link from 'app/components/links/link';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';

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
    const {eventView, event, organization, location} = this.props;
    const crumbs: React.ReactNode[] = [];

    if (eventView && eventView.isValid()) {
      const eventTarget = {
        pathname: `/organizations/${organization.slug}/eventsv2/`,
        query: eventView.generateQueryStringObject(),
      };

      const discoverTarget = {
        pathname: `/organizations/${organization.slug}/eventsv2/`,
        query: {
          ...location.query,
          ...eventView.generateBlankQueryStringObject(),
          ...eventView.getGlobalSelection(),
        },
      };

      crumbs.push(
        <BreadcrumbItem to={discoverTarget} key="eventview-home">
          {t('Discover')}
        </BreadcrumbItem>
      );

      crumbs.push(
        <span key="eventview-sep">
          <StyledIcon src="icon-chevron-right" />
        </span>
      );

      crumbs.push(
        <BreadcrumbItem to={eventTarget} key="eventview-link">
          {eventView.name}
        </BreadcrumbItem>
      );
    }

    if (event) {
      crumbs.push(
        <span key="event-sep">
          <StyledIcon src="icon-chevron-right" />
        </span>
      );

      crumbs.push(<BreadcrumbItem key="event-name">{t('Event Detail')}</BreadcrumbItem>);
    }

    return crumbs;
  }

  render() {
    const {eventView} = this.props;

    return (
      <BreadcrumbList>
        {eventView && eventView.isValid() ? (
          this.getCrumbs()
        ) : (
          <StyledHeader>{t('Discover')}</StyledHeader>
        )}
        <BetaTag />
      </BreadcrumbList>
    );
  }
}

const StyledHeader = styled('span')`
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.gray4};
`;

const BreadcrumbList = styled('span')`
  display: flex;
  align-items: center;
  height: 40px;
`;

const BreadcrumbItem = styled(Link)`
  color: ${p => p.theme.gray2};

  &:nth-last-child(2) {
    color: ${p => p.theme.gray4};
  }

  &:hover,
  &:active {
    color: ${p => p.theme.gray3};
  }
`;

const StyledIcon = styled(InlineSvg)`
  color: inherit;
  height: 12px;
  width: 12px;
  margin: 0 ${space(1)} ${space(0.5)} ${space(1)};
`;

export default DiscoverBreadcrumb;
