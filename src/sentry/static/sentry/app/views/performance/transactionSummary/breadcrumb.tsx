import React from 'react';
import {Location} from 'history';

import {t} from 'app/locale';
import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import Breadcrumbs, {Crumb} from 'app/components/breadcrumbs';

import {getPerformanceLandingUrl} from '../utils';
import {transactionSummaryRouteWithEventView} from './utils';

type Props = {
  eventView: EventView;
  organization: Organization;
  location: Location;
  transactionName: string;
};

class Breadcrumb extends React.Component<Props> {
  getCrumbs() {
    const crumbs: Crumb[] = [];
    const {eventView, organization, location, transactionName} = this.props;

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

    crumbs.push({
      to: performanceTarget,
      label: t('Performance'),
    });

    const summaryTarget = transactionSummaryRouteWithEventView({
      orgSlug: organization.slug,
      transaction: transactionName,
      projectID: eventView.project.map(id => String(id)),
    });

    crumbs.push({
      to: summaryTarget,
      label: t('Transaction Summary'),
    });

    return crumbs;
  }

  render() {
    return <Breadcrumbs crumbs={this.getCrumbs()} />;
  }
}

export default Breadcrumb;
