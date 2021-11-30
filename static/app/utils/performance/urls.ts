import {LocationDescriptor, Query} from 'history';

import {spanTargetHash} from 'sentry/components/events/interfaces/spans/utils';
import {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';

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
    pathname: `/organizations/${orgSlug}/performance/${eventSlug}/`,
    query: locationQuery,
    hash: defined(spanId) ? spanTargetHash(spanId) : undefined,
  };
  if (!defined(target.hash)) {
    delete target.hash;
  }

  return target;
}
