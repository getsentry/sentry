import type {Query} from 'history';

import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {getTransactionSummaryBaseUrl} from 'sentry/views/performance/transactionSummary/utils';

export function aggregateWaterfallRouteWithQuery({
  orgSlug,
  transaction,
  projectID,
  query,
  view,
}: {
  orgSlug: string;
  query: Query;
  transaction: string;
  projectID?: string | string[];
  view?: DomainView;
}) {
  const pathname = `${getTransactionSummaryBaseUrl(orgSlug, view)}/aggregateWaterfall/`;

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
