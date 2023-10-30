import {Location, LocationDescriptor} from 'history';

import Breadcrumbs, {Crumb} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {SpanSlug} from 'sentry/utils/performance/suspectSpans/types';
import {decodeScalar} from 'sentry/utils/queryString';

import Tab from './transactionSummary/tabs';
import {eventsRouteWithQuery} from './transactionSummary/transactionEvents/utils';
import {spansRouteWithQuery} from './transactionSummary/transactionSpans/utils';
import {tagsRouteWithQuery} from './transactionSummary/transactionTags/utils';
import {vitalsRouteWithQuery} from './transactionSummary/transactionVitals/utils';
import {transactionSummaryRouteWithQuery} from './transactionSummary/utils';
import {vitalDetailRouteWithQuery} from './vitalDetail/utils';
import {getPerformanceLandingUrl} from './utils';

type Props = {
  location: Location;
  organization: Organization;
  eventSlug?: string;
  spanSlug?: SpanSlug;
  tab?: Tab;
  traceSlug?: string;
  transaction?: {
    name: string;
    project: string;
  };
  vitalName?: string;
};

function Breadcrumb(props: Props) {
  function getCrumbs() {
    const crumbs: Crumb[] = [];
    const {
      organization,
      location,
      transaction,
      vitalName,
      spanSlug,
      eventSlug,
      traceSlug,
      tab,
    } = props;

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
      preservePageFilters: true,
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
        preservePageFilters: true,
      });
    } else if (transaction) {
      const routeQuery = {
        orgSlug: organization.slug,
        transaction: transaction.name,
        projectID: transaction.project,
        query: location.query,
      };

      switch (tab) {
        case Tab.TAGS: {
          const tagsTarget = tagsRouteWithQuery(routeQuery);
          crumbs.push({
            to: tagsTarget,
            label: t('Tags'),
            preservePageFilters: true,
          });
          break;
        }
        case Tab.EVENTS: {
          const eventsTarget = eventsRouteWithQuery(routeQuery);
          crumbs.push({
            to: eventsTarget,
            label: t('All Events'),
            preservePageFilters: true,
          });
          break;
        }
        case Tab.WEB_VITALS: {
          const webVitalsTarget = vitalsRouteWithQuery(routeQuery);
          crumbs.push({
            to: webVitalsTarget,
            label: t('Web Vitals'),
            preservePageFilters: true,
          });
          break;
        }
        case Tab.SPANS: {
          const spansTarget = spansRouteWithQuery(routeQuery);
          crumbs.push({
            to: spansTarget,
            label: t('Spans'),
            preservePageFilters: true,
          });
          break;
        }
        case Tab.TRANSACTION_SUMMARY:
        default: {
          const summaryTarget = transactionSummaryRouteWithQuery(routeQuery);
          crumbs.push({
            to: summaryTarget,
            label: t('Transaction Summary'),
            preservePageFilters: true,
          });
        }
      }
    }

    if (transaction && spanSlug) {
      crumbs.push({
        to: '',
        label: t('Span Summary'),
      });
    } else if (transaction && eventSlug) {
      crumbs.push({
        to: '',
        label: t('Event Details'),
      });
    } else if (traceSlug) {
      crumbs.push({
        to: '',
        label: t('Trace View'),
      });
    }

    return crumbs;
  }

  return <Breadcrumbs crumbs={getCrumbs()} />;
}

export default Breadcrumb;
