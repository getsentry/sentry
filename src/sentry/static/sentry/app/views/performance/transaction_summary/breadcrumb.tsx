import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Organization} from 'app/types';
import Link from 'app/components/links/link';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';
import EventView from 'app/views/eventsV2/eventView';

import {getPerformanceLandingUrl} from '../utils';
import {transactionSummaryRouteWithEventView} from './utils';

type Props = {
  eventView: EventView;
  organization: Organization;
  location: Location;
  transactionName: string;
};

class Breadcrumb extends React.Component<Props> {
  getCrumbs(): React.ReactNode {
    const {eventView, organization, location, transactionName} = this.props;
    const crumbs: React.ReactNode[] = [];

    const performanceTarget = {
      pathname: getPerformanceLandingUrl(organization),
      query: {
        ...location.query,
        ...eventView.generateBlankQueryStringObject(),
        ...eventView.getGlobalSelection(),
        // clear out the transaction name
        transaction: undefined,
      },
    };

    crumbs.push(
      <BreadcrumbItem to={performanceTarget} key="performance-landing">
        {t('Performance')}
      </BreadcrumbItem>
    );

    const summaryTarget = transactionSummaryRouteWithEventView({
      orgSlug: organization.slug,
      transaction: transactionName,
      projectID: eventView.project.map(id => String(id)),
    });

    crumbs.push(
      <span key="breadcrumb-sep">
        <StyledIcon src="icon-chevron-right" />
      </span>
    );

    crumbs.push(
      <BreadcrumbItem to={summaryTarget} key="summary-link">
        {t('Transaction Summary')}
      </BreadcrumbItem>
    );

    return crumbs;
  }

  render() {
    return <BreadcrumbList>{this.getCrumbs()}</BreadcrumbList>;
  }
}

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

export default Breadcrumb;
