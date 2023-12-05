import {Query} from 'history';

import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

export function aggregateWaterfallRouteWithQuery({
  orgSlug,
  transaction,
  projectID,
  query,
}: {
  orgSlug: string;
  query: Query;
  transaction: string;
  projectID?: string | string[];
}) {
  const pathname = `/organizations/${orgSlug}/performance/summary/aggregateWaterfall/`;

  const filter = decodeScalar(query.query);
  let httpMethod: string | undefined = undefined;
  if (filter) {
    const search = new MutableSearch(filter);
    const method = search.tokens.find(token => token.key === 'http.method');
    if (method) {
      httpMethod = method.value;
    }
  }

  return {
    pathname,
    query: {
      transaction,
      project: projectID,
      environment: query.environment,
      statsPeriod: query.statsPeriod,
      start: query.start,
      end: query.end,
      query: query.query,
      ...(httpMethod ? {'http.method': httpMethod} : null),
    },
  };
}
