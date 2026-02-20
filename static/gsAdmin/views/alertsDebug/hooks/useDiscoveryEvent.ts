import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useApiQuery} from 'sentry/utils/queryClient';

// Minimal fields for list view - only what's needed for the card header
const LIST_FIELDS = ['id', 'title', 'message', 'platform', 'timestamp'];

// All fields for detail view - fetched on-demand when expanding an event
export const EVENT_DETAIL_FIELDS = [
  'id',
  'title',
  'message',
  'platform',
  'timestamp',
  'project',
  'project.id',
  'release',
  'environment',
  'user',
  'user.email',
  'user.id',
  'user.ip_address',
  'user.username',
  'sdk.name',
  'sdk.version',
  'os.name',
  'os.version',
  'browser.name',
  'browser.version',
  'device.family',
  'tags',
  'transaction',
  'trace',
  'profile.id',
];

interface EventEntry {
  [key: string]: unknown;
  id: string;
  timestamp: string;
  message?: string;
  platform?: string;
  title?: string;
}

interface EventsResponse {
  data: EventEntry[];
  meta?: {
    fields: Record<string, string>;
  };
}

/**
 * Hook to fetch event data via the discovery API.
 * Fetches minimal fields for list view display.
 *
 * @param organizationId - The organization ID or slug
 * @param eventId - The event ID to fetch
 */
export function useDiscoveryEvent(
  organizationId: string | undefined,
  eventId: string | undefined
) {
  const result = useApiQuery<EventsResponse>(
    [
      `/organizations/${organizationId}/events/`,
      {
        query: {
          dataset: DiscoverDatasets.DISCOVER,
          field: LIST_FIELDS,
          per_page: 1,
          query: `id:"${eventId}"`,
          referrer: 'admin.alerts-debug.event-card',
          statsPeriod: '14d',
        },
      },
    ],
    {
      staleTime: Infinity, // Events are immutable
      enabled: !!organizationId && !!eventId,
    }
  );

  // Transform response to extract the first event
  return {
    ...result,
    data: result.data?.data?.[0],
  };
}

/**
 * Hook to fetch detailed event data on-demand.
 * Used when expanding an event card to show full details.
 *
 * @param organizationId - The organization ID or slug
 * @param eventId - The event ID to fetch details for
 */
export function useEventDetails(
  organizationId: string | undefined,
  eventId: string | undefined
) {
  return useApiQuery<EventsResponse>(
    [
      `/organizations/${organizationId}/events/`,
      {
        query: {
          dataset: DiscoverDatasets.DISCOVER,
          field: EVENT_DETAIL_FIELDS,
          per_page: 1,
          query: `id:"${eventId}"`,
          referrer: 'admin.alerts-debug.event-details',
        },
      },
    ],
    {
      staleTime: Infinity, // Events are immutable
      enabled: !!organizationId && !!eventId,
    }
  );
}
