import type {Location} from 'history';

import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {updateNullableLocation} from 'sentry/views/explore/queryParams/location';
import {getQueryFromLocation} from 'sentry/views/explore/queryParams/query';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

const REPLAY_QUERY_KEY = 'query';

export function isDefaultFields(_location: Location): boolean {
  return true; // Replays always uses default fields
}

export function getReadableQueryParamsFromLocation(
  location: Location
): ReadableQueryParams {
  const query = getQueryFromLocation(location, REPLAY_QUERY_KEY) ?? '';

  return new ReadableQueryParams({
    extrapolate: false,
    mode: Mode.SAMPLES,
    query,
    cursor: '',
    fields: [],
    sortBys: [],
    aggregateCursor: '',
    aggregateFields: [],
    aggregateSortBys: [],
  });
}

export function getTargetWithReadableQueryParams(
  location: Location,
  writableQueryParams: WritableQueryParams
): Location {
  const target: Location = {...location, query: {...location.query}};

  updateNullableLocation(target, REPLAY_QUERY_KEY, writableQueryParams.query);

  return target;
}
