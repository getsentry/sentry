import {useRef} from 'react';
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

const PREFETCH_DELAY_MS = 300;

/**
 * Warms the preview's requests on hover so clicking renders from cache. Reuses
 * the preview's own options factories so the query keys match. The event is
 * included because External Links is gated on it and sits above the feed.
 */
export function useInboxPreviewPrefetch(groupId: string) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const location = useLocation();
  const environments = useEnvironmentsFromUrl();
  const eventQuery = useEventQuery();
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const {hoverProps} = useHover({
    onHoverStart: () => {
      timeoutRef.current = setTimeout(() => {
        queryClient.prefetchQuery(
          groupApiOptions({
            groupId,
            organizationSlug: organization.slug,
            environments,
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
      }, PREFETCH_DELAY_MS);
    },
    onHoverEnd: () => {
      clearTimeout(timeoutRef.current);
    },
  });

  return hoverProps;
}
