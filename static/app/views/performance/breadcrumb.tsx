import {Component} from 'react';
import {Location, LocationDescriptor} from 'history';

import Breadcrumbs, {Crumb} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {decodeScalar} from 'sentry/utils/queryString';

import Tab from './transactionSummary/tabs';
import {eventsRouteWithQuery} from './transactionSummary/transactionEvents/utils';
import {tagsRouteWithQuery} from './transactionSummary/transactionTags/utils';
import {vitalsRouteWithQuery} from './transactionSummary/transactionVitals/utils';
import {transactionSummaryRouteWithQuery} from './transactionSummary/utils';
import {vitalDetailRouteWithQuery} from './vitalDetail/utils';
import {getPerformanceLandingUrl} from './utils';

type Props = {
  organization: Organization;
  location: Location;
  transaction?: {
    project: string;
    name: string;
  };
  vitalName?: string;
  eventSlug?: string;
  traceSlug?: string;
  transactionComparison?: boolean;
  tab?: Tab;
};

class Breadcrumb extends Component<Props> {
  getCrumbs() {
    const crumbs: Crumb[] = [];
    const {
      organization,
      location,
      transaction,
      vitalName,
      eventSlug,
      traceSlug,
      transactionComparison,
      tab,
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

    if (vitalName) {
      const webVitalsTarget = vitalDetailRouteWithQuery({
        orgSlug: organization.slug,
        vitalName: 'fcp',
        projectID: decodeScalar(location.query.project),
        query: location.query,
      });
      crumbs.push({
        to: webVitalsTarget,
        label: t('Vital Detail'),
        preserveGlobalSelection: true,
      });
    } else if (transaction) {
      const routeQuery = {
        orgSlug: organization.slug,
        transaction: transaction.name,
        projectID: transaction.project,
        query: location.query,
      };

      switch (tab) {
        case Tab.Tags: {
          const tagsTarget = tagsRouteWithQuery(routeQuery);
          crumbs.push({
            to: tagsTarget,
            label: t('Tags'),
            preserveGlobalSelection: true,
          });
          break;
        }
        case Tab.Events: {
          const eventsTarget = eventsRouteWithQuery(routeQuery);
          crumbs.push({
            to: eventsTarget,
            label: t('All Events'),
            preserveGlobalSelection: true,
          });
          break;
        }
        case Tab.WebVitals: {
          const webVitalsTarget = vitalsRouteWithQuery(routeQuery);
          crumbs.push({
            to: webVitalsTarget,
            label: t('Web Vitals'),
            preserveGlobalSelection: true,
          });
          break;
        }
        case Tab.TransactionSummary:
        default: {
          const summaryTarget = transactionSummaryRouteWithQuery(routeQuery);
          crumbs.push({
            to: summaryTarget,
            label: t('Transaction Summary'),
            preserveGlobalSelection: true,
          });
        }
      }
    }

    if (transaction && eventSlug) {
      crumbs.push({
        to: '',
        label: t('Event Details'),
      });
    } else if (transactionComparison) {
      crumbs.push({
        to: '',
        label: t('Compare to Baseline'),
      });
    } else if (traceSlug) {
      crumbs.push({
        to: '',
        label: t('Trace View'),
      });
    }

    return crumbs;
  }

  render() {
    return <Breadcrumbs crumbs={this.getCrumbs()} />;
  }
}

export default Breadcrumb;
