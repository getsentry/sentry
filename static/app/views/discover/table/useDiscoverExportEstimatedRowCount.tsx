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

interface UseDiscoverExportEstimatedRowCountResult {
  estimatedRowCount: number;
  /** True while the estimate is being fetched and no value is available yet. */
  isPending: boolean;
}

export function useDiscoverExportEstimatedRowCount({
  enabled,
  eventView,
  loadedRowCount,
  location,
}: UseDiscoverExportEstimatedRowCountOptions): UseDiscoverExportEstimatedRowCountResult {
  const organization = useOrganization();

  const payload = eventView.getEventsAPIPayload(location);

  const {data, isLoading, isError} = useQuery({
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

  // When the count can't be fetched we only know about the rows already loaded,
  // so estimate from those rather than fabricating a large total that would push
  // even a tiny, fully-loaded result into the async (email) export.
  const estimatedRowCount = isError
    ? loadedRowCount
    : Math.max(loadedRowCount, data?.count ?? 0);

  return {
    estimatedRowCount,
    isPending: isLoading,
  };
}
