import type {LocationDescriptor, Query} from 'history';

import {spanTargetHash} from 'sentry/components/events/interfaces/spans/utils';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';

import {normalizeUrl} from '../withDomainRequired';

/**
 * Routes to the transaction event details view.
 *
 * TODO Abdullah Khan: Add link to new trace view doc explaining why we route to the traceview.
 *
 * @deprecated Use generateLinkToEventInTraceView instead, since we are pushing towards events always being displayed in the trace view.
 */
export function getTransactionDetailsUrl(
  orgSlug: Organization['slug'],
  eventSlug: string,
  transaction?: string,
  query?: Query,
  spanId?: string
): LocationDescriptor {
  const locationQuery = {
    ...(query || {}),
    transaction,
  };
  if (!defined(locationQuery.transaction)) {
    delete locationQuery.transaction;
  }

  const target = {
    pathname: normalizeUrl(`/organizations/${orgSlug}/performance/${eventSlug}/`),
    query: locationQuery,
    hash: defined(spanId) ? spanTargetHash(spanId) : undefined,
  };
  if (!defined(target.hash)) {
    delete target.hash;
  }

  return target;
}
