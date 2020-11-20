import {Location, LocationDescriptor, Query} from 'history';

import {GlobalSelection, OrganizationSummary} from 'app/types';
import {statsPeriodToDays} from 'app/utils/dates';
import getCurrentSentryReactTransaction from 'app/utils/getCurrentSentryReactTransaction';
import {decodeScalar} from 'app/utils/queryString';

export function getPerformanceLandingUrl(organization: OrganizationSummary): string {
  return `/organizations/${organization.slug}/performance/`;
}

export function getTransactionSearchQuery(location: Location) {
  return String(decodeScalar(location.query.query) || '').trim();
}

export function getTransactionDetailsUrl(
  organization: OrganizationSummary,
  eventSlug: string,
  transaction: string,
  query: Query
): LocationDescriptor {
  return {
    pathname: `/organizations/${organization.slug}/performance/${eventSlug}/`,
    query: {
      ...query,
      transaction,
    },
  };
}

export function getTransactionComparisonUrl({
  organization,
  baselineEventSlug,
  regressionEventSlug,
  transaction,
  query,
}: {
  organization: OrganizationSummary;
  baselineEventSlug: string;
  regressionEventSlug: string;
  transaction: string;
  query: Query;
}): LocationDescriptor {
  return {
    pathname: `/organizations/${organization.slug}/performance/compare/${baselineEventSlug}/${regressionEventSlug}/`,
    query: {
      ...query,
      transaction,
    },
  };
}

export function addRoutePerformanceContext(selection: GlobalSelection) {
  const transaction = getCurrentSentryReactTransaction();
  const days = statsPeriodToDays(
    selection.datetime.period,
    selection.datetime.start,
    selection.datetime.end
  );
  const seconds = Math.floor(days * 86400);

  transaction?.setTag('statsPeriod', seconds.toString());
}

export function getTransactionName(location: Location): string | undefined {
  const {transaction} = location.query;

  return decodeScalar(transaction);
}
