import type {Location, LocationDescriptor} from 'history';

import type {Crumb} from 'sentry/components/breadcrumbs';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {SpanSlug} from 'sentry/utils/performance/suspectSpans/types';
import {decodeScalar} from 'sentry/utils/queryString';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {vitalDetailRouteWithQuery} from 'sentry/views/performance/vitalDetail/utils';

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
  vitalName,
}: {
  location: Location;
  organization: Organization;
  eventSlug?: string;
  spanSlug?: SpanSlug;
  traceSlug?: string;
  transaction?: {
    name: string;
    project: string;
  };
  view?: DomainView;
  vitalName?: string;
}) => {
  const crumbs: Crumb[] = [];

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
    return crumbs;
  }

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

  if (spanSlug) {
    crumbs.push({
      to: '',
      label: t('Span Summary'),
    });
  } else if (eventSlug) {
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
