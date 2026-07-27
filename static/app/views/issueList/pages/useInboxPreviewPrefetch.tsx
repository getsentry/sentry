import {useCallback, useEffect, useRef} from 'react';
import {useHover} from '@react-aria/interactions';
import {useQueryClient} from '@tanstack/react-query';

import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useEventQuery} from 'sentry/views/issueDetails/hooks/useEventQuery';
import {groupApiOptions} from 'sentry/views/issueDetails/useGroup';
import {
  groupEventApiOptions,
  useEnvironmentsFromUrl,
} from 'sentry/views/issueDetails/utils';

// Long enough that scrolling the list doesn't fire a request per row.
const PREFETCH_DELAY_MS = 300;

/**
 * Warms the preview's requests while hovering an inbox row, so clicking renders
 * from cache instead of waiting on the network.
 *
 * Both the group and its recommended event are prefetched: the event request
 * can't start until the group resolves, so warming only the group would leave
 * the second round trip on the critical path.
 *
 * The options factories are shared with the preview's own hooks, so the query
 * keys match and the prefetched entries are the ones it reads.
 */
export function useInboxPreviewPrefetch(groupId: string) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const location = useLocation();
  const environments = useEnvironmentsFromUrl();
  const eventQuery = useEventQuery();
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const prefetch = useCallback(() => {
    queryClient.prefetchQuery(
      groupApiOptions({
        groupId,
        organizationSlug: organization.slug,
        environments,
        // Must match useGroup, or this warms a different cache key and the
        // click refetches anyway.
        expandDerivedData: organization.features.includes('issue-stream-progress-ui'),
      })
    );
    queryClient.prefetchQuery(
      groupEventApiOptions({
        orgSlug: organization.slug,
        groupId,
        eventId: 'recommended',
        environments,
        query: eventQuery,
        statsPeriod: decodeScalar(location.query.statsPeriod),
        start: decodeScalar(location.query.start),
        end: decodeScalar(location.query.end),
      })
    );
  }, [queryClient, groupId, organization, environments, eventQuery, location.query]);

  const {hoverProps} = useHover({
    onHoverStart: () => {
      timeoutRef.current = setTimeout(prefetch, PREFETCH_DELAY_MS);
    },
    onHoverEnd: () => {
      clearTimeout(timeoutRef.current);
    },
  });

  return hoverProps;
}
