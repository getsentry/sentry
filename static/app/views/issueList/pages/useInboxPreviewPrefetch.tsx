import {useRef} from 'react';
import {useHover} from '@react-aria/interactions';
import {useQueryClient} from '@tanstack/react-query';

import {useOrganization} from 'sentry/utils/useOrganization';
import {groupApiOptions} from 'sentry/views/issueDetails/useGroup';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

const PREFETCH_DELAY_MS = 300;

/**
 * Warms the preview's request on hover so clicking renders from cache. Reuses
 * the preview's own options factory so the query key matches.
 */
export function useInboxPreviewPrefetch(groupId: string) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const environments = useEnvironmentsFromUrl();
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
      }, PREFETCH_DELAY_MS);
    },
    onHoverEnd: () => {
      clearTimeout(timeoutRef.current);
    },
  });

  return hoverProps;
}
