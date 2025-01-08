import type {Location, LocationDescriptor} from 'history';

import type {Crumb} from 'sentry/components/breadcrumbs';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {SpanSlug} from 'sentry/utils/performance/suspectSpans/types';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';

import type Tab from './transactionSummary/tabs';
import {transactionSummaryRouteWithQuery} from './transactionSummary/utils';
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

    crumbs.push(
      ...getTabCrumbs({
        location,
        organization,
        transaction,
        vitalName,
        spanSlug,
        eventSlug,
        traceSlug,
        tab,
      })
    );

    return crumbs;
  }

  return <Breadcrumbs crumbs={getCrumbs()} />;
}

export const getTabCrumbs = ({
  location,
  organization,
  transaction,
  spanSlug,
  eventSlug,
  traceSlug,
  view,
}: {
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
  view?: DomainView;
  vitalName?: string;
}) => {
  const crumbs: Crumb[] = [];

  if (!transaction) {
    return crumbs;
  }

  const routeQuery = {
    orgSlug: organization.slug,
    transaction: transaction.name,
    projectID: transaction.project,
    query: location.query,
    view,
  };

  crumbs.push({
    to: transactionSummaryRouteWithQuery(routeQuery),
    label: t('Transaction Summary'),
    preservePageFilters: true,
  });

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
      label: t('Trace Details'),
    });
  }

  return crumbs;
};

export default Breadcrumb;
