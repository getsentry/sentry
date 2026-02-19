import type {Location} from 'history';

import type {Crumb} from 'sentry/components/breadcrumbs';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {SpanSlug} from 'sentry/utils/performance/suspectSpans/types';
import {DOMAIN_VIEW_BASE_TITLE} from 'sentry/views/insights/pages/settings';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';

import type Tab from './transactionSummary/tabs';
import {transactionSummaryRouteWithQuery} from './transactionSummary/utils';

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
};

function Breadcrumb(props: Props) {
  function getCrumbs() {
    const crumbs: Crumb[] = [];
    const {organization, location, transaction, spanSlug, eventSlug, traceSlug} = props;

    crumbs.push({
      label: DOMAIN_VIEW_BASE_TITLE,
    });

    crumbs.push(
      ...getTabCrumbs({
        location,
        organization,
        transaction,
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
}) => {
  const crumbs: Crumb[] = [];

  if (!transaction) {
    return crumbs;
  }

  const routeQuery = {
    organization,
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
