import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

import type {InboxFilters, InboxItem} from './types';

const INBOX_ITEMS_PER_PAGE = 25;

export function inboxItemsApiOptions(organization: Organization, filters: InboxFilters) {
  return {
    ...apiOptions.asInfinite<InboxItem[]>()(
      '/organizations/$organizationIdOrSlug/inbox/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          per_page: INBOX_ITEMS_PER_PAGE,
          ...(filters.subjectType.length > 0 && {subject_type: filters.subjectType}),
          ...(filters.eventType.length > 0 && {event_type: filters.eventType}),
        },
        staleTime: 30_000,
      }
    ),
    refetchOnWindowFocus: 'always' as const,
  };
}
