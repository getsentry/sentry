import {Location, LocationDescriptor, Query} from 'history';

import {OrganizationSummary, GlobalSelection} from 'app/types';
import {decodeScalar} from 'app/utils/queryString';
import getCurrentSentryReactTransaction from 'app/utils/getCurrentSentryReactTransaction';
import {statsPeriodToDays} from 'app/utils/dates';

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
