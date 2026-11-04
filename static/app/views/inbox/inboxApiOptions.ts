import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {InboxItem} from 'sentry/views/inbox/types';

const INBOX_ITEMS_PER_PAGE = 25;

export function inboxItemsApiOptions(organization: Organization) {
  return apiOptions.asInfinite<InboxItem[]>()(
    '/organizations/$organizationIdOrSlug/inbox/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {per_page: INBOX_ITEMS_PER_PAGE},
      staleTime: 30_000,
    }
  );
}
