import {useQuery} from '@tanstack/react-query';
import type {Location} from 'history';
import pick from 'lodash/pick';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {EventView} from 'sentry/utils/discover/eventView';
import {PERFORMANCE_URL_PARAM} from 'sentry/utils/performance/constants';
import {useOrganization} from 'sentry/utils/useOrganization';

interface EventsMetaResponse {
  count: number;
}

interface UseDiscoverExportEstimatedRowCountOptions {
  enabled: boolean;
  eventView: EventView;
  loadedRowCount: number;
  location: Location;
}

export function useDiscoverExportEstimatedRowCount({
  enabled,
  eventView,
  loadedRowCount,
  location,
}: UseDiscoverExportEstimatedRowCountOptions): number {
  const organization = useOrganization();

  const payload = eventView.getEventsAPIPayload(location);

  const {data} = useQuery({
    ...apiOptions.as<EventsMetaResponse>()(
      '/organizations/$organizationIdOrSlug/events-meta/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {...pick(payload, PERFORMANCE_URL_PARAM), query: payload.query},
        staleTime: 30_000,
      }
    ),
    enabled,
  });

  return Math.max(loadedRowCount, data?.count ?? 0);
}
