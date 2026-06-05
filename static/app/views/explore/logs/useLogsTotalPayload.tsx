import {useQuery} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/typesBase';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useLogsFrozenProjectIds} from 'sentry/views/explore/logs/logsFrozenContext';
import {getEventView} from 'sentry/views/insights/common/queries/useDiscover';
import {getStaleTimeForEventView} from 'sentry/views/insights/common/queries/useSpansQuery';

type TotalPayloadResult = {
  data: Array<{'sum(payload_size)': number}>;
};

export function useLogsTotalPayload({enabled}: {enabled: boolean}): number | undefined {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const location = useLocation();
  const projectIds = useLogsFrozenProjectIds();

  const eventView = getEventView(
    new MutableSearch(''),
    ['sum(payload_size)'],
    [],
    selection,
    DiscoverDatasets.OURLOGS,
    projectIds ?? selection.projects
  );

  const options = apiOptions.as<TotalPayloadResult>()(
    '/organizations/$organizationIdOrSlug/events/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        ...eventView.getEventsAPIPayload(location),
        referrer: 'api.explore.logs-dataset-total',
      },
      staleTime: getStaleTimeForEventView(eventView),
    }
  );

  const result = useQuery({
    ...options,
    enabled,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return result.data?.data?.[0]?.['sum(payload_size)'];
}
