import React from 'react';
import styled from 'react-emotion';
import {Location} from 'history';

import {t} from 'app/locale';
import {Event, Organization} from 'app/types';
import BetaTag from 'app/components/betaTag';
import Link from 'app/components/links/link';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

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
          <StyledIcon src="icon-chevron-right" />
        </span>
      );

      crumbs.push(
        <BreadcrumbItem to={target} key="eventview-link">
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
      <BreadcrumbList>
        <BreadcrumbItem to={target}>{t('Discover')}</BreadcrumbItem>
        {this.getCrumbs()}
        <BetaTag />
      </BreadcrumbList>
    );
  }
}

const BreadcrumbList = styled('span')`
  display: flex;
  align-items: center;
  height: 40px;
`;

const BreadcrumbItem = styled(Link)`
  color: ${theme.gray2};

  &:nth-last-child(2) {
    color: ${theme.gray4};
  }
`;

const StyledIcon = styled(InlineSvg)`
  color: inherit;
  height: 12px;
  width: 12px;
  margin: 0 ${space(1)} ${space(0.5)} ${space(1)};
`;

export default DiscoverBreadcrumb;
