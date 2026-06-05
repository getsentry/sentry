import type {Location} from 'history';

import {EventView} from 'sentry/utils/discover/eventView';
import {isAggregateField} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/typesBase';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

export function generateTransactionOverviewEventView({
  location,
  transactionName,
}: {
  location: Location;
  transactionName: string;
}): EventView {
  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);

  conditions.setFilterValues('is_transaction', ['true']);
  conditions.setFilterValues(
    'transaction.method',
    conditions.getFilterValues('http.method')
  );
  conditions.removeFilter('http.method');
  conditions.setFilterValues('transaction', [transactionName]);

  Object.keys(conditions.filters).forEach(field => {
    if (isAggregateField(field)) {
      conditions.removeFilter(field);
    }
  });

  const fields = [
    'id',
    'user.email',
    'user.username',
    'user.id',
    'user.ip',
    'span.duration',
    'trace',
    'timestamp',
  ];

  return EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields,
      query: conditions.formatString(),
      projects: [],
      dataset: DiscoverDatasets.SPANS,
    },
    location
  );
}
