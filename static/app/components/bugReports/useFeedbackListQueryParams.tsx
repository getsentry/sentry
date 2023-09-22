import {Location} from 'history';

import {FeedbackListQueryParams} from 'sentry/utils/feedback/types';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';

export default function useFeedbackListQueryParams({
  location,
  queryReferrer,
}: {
  location: Location;
  queryReferrer: string;
}): FeedbackListQueryParams {
  const {
    cursor,
    end,
    environment,
    field,
    offset,
    per_page,
    project,
    query,
    sort,
    start,
    statsPeriod,
  } = location.query;

  return {
    cursor: decodeScalar(cursor),
    end: decodeScalar(end),
    environment: decodeList(environment),
    field: decodeList(field),
    offset: decodeScalar(offset),
    per_page: decodeScalar(per_page),
    project: decodeList(project),
    query: decodeScalar(query),
    sort: decodeScalar(sort),
    start: decodeScalar(start),
    statsPeriod: decodeScalar(statsPeriod),
    queryReferrer,
  };
}
