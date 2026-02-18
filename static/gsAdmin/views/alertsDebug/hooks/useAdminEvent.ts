import type {Event} from 'sentry/types/event';
import {useApiQuery} from 'sentry/utils/queryClient';

/**
 * Hook to fetch event data via the internal admin API.
 * This is only accessible to superusers/staff.
 * Does not require project context.
 */
export function useAdminEvent(eventId: string | undefined) {
  return useApiQuery<Event>([`/internal/_admin/events/${eventId}/`], {
    staleTime: Infinity, // Events are immutable
    enabled: !!eventId,
  });
}
