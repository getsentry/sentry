import type {TableData} from 'sentry/utils/discover/discoverQuery';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import type EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export function useTableQuery({
  eventView,
  enabled,
  referrer,
  initialData,
  limit,
  staleTime,
  cursor,
}: {
  eventView: EventView;
  cursor?: string;
  enabled?: boolean;
  excludeOther?: boolean;
  initialData?: TableData;
  limit?: number;
  referrer?: string;
  staleTime?: number;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const {isReady: pageFiltersReady} = usePageFilters();

  const result = useDiscoverQuery({
    eventView,
    location,
    orgSlug: organization.slug,
    limit: limit ?? 25,
    referrer,
    cursor,
    options: {
      refetchOnWindowFocus: false,
      enabled: enabled && pageFiltersReady,
      staleTime,
    },
  });

  return {
    ...result,
    data: result.isPending ? initialData : result.data,
    pageLinks: result.pageLinks,
  };
}
