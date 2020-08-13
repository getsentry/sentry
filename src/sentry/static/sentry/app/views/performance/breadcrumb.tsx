import React from 'react';
import {Location, LocationDescriptor} from 'history';

import {t} from 'app/locale';
import {Organization} from 'app/types';
import Breadcrumbs, {Crumb} from 'app/components/breadcrumbs';
import {decodeScalar} from 'app/utils/queryString';

import {getPerformanceLandingUrl} from './utils';
import {transactionSummaryRouteWithQuery} from './transactionSummary/utils';

type Props = {
  organization: Organization;
  location: Location;
  transactionName?: string;
  eventSlug?: string;
  transactionComparison?: boolean;
};

class Breadcrumb extends React.Component<Props> {
  getCrumbs() {
    const crumbs: Crumb[] = [];
    const {
      organization,
      location,
      transactionName,
      eventSlug,
      transactionComparison,
    } = this.props;

    const performanceTarget: LocationDescriptor = {
      pathname: getPerformanceLandingUrl(organization),
      query: {
        ...location.query,
        // clear out the transaction name
        transaction: undefined,
      },
    };

    crumbs.push({
      to: performanceTarget,
      label: t('Performance'),
      preserveGlobalSelection: true,
    });

    if (transactionName) {
      const summaryTarget = transactionSummaryRouteWithQuery({
        orgSlug: organization.slug,
        transaction: transactionName,
        projectID: decodeScalar(location.query.project),
        query: location.query,
      });

      crumbs.push({
        to: summaryTarget,
        label: t('Transaction Summary'),
        preserveGlobalSelection: true,
      });
    }

    if (transactionName && eventSlug) {
      crumbs.push({
        to: '',
        label: t('Event Details'),
      });
    } else if (transactionComparison) {
      crumbs.push({
        to: '',
        label: t('Compare to Baseline'),
      });
    }

    return crumbs;
  }

  render() {
    return <Breadcrumbs crumbs={this.getCrumbs()} />;
  }
}

export default Breadcrumb;
