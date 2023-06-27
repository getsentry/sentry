import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export default function useErrorSamples(eventView: EventView) {
  const location = useLocation();
  const organization = useOrganization();

  const columns: QueryFieldValue[] = [
    {
      field: 'timestamp',
      kind: 'field',
    },
    {
      field: 'http.status_code',
      kind: 'field',
    },
    {
      field: 'transaction.status',
      kind: 'field',
    },
  ];

  let errorSamplesEventView = eventView.clone();
  errorSamplesEventView.additionalConditions = new MutableSearch(
    'http.status_code:[500,501,502,503,504,505,506,507,508,510,511]'
  );
  errorSamplesEventView = errorSamplesEventView.withColumns(columns).withSorts([
    {
      field: 'timestamp',
      kind: 'desc',
    },
  ]);

  const {isLoading, data} = useDiscoverQuery({
    eventView: errorSamplesEventView,
    referrer: 'starfish-transaction-summary-sample-events',
    location,
    orgSlug: organization.slug,
    limit: 6,
  });

  return {isLoading, data: data ? data.data : []};
}
