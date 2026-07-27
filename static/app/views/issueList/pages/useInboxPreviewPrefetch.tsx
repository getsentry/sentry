import {useEffect, useRef} from 'react';
import {useHover} from '@react-aria/interactions';
import {useQueryClient} from '@tanstack/react-query';

import {useOrganization} from 'sentry/utils/useOrganization';
import {groupApiOptions} from 'sentry/views/issueDetails/useGroup';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

const PREFETCH_DELAY_MS = 300;

/**
 * Warms the group request while hovering an inbox row, so clicking renders the
 * preview from cache. Reuses `useGroup`'s options factory so the query keys
 * match; `expandDerivedData` is part of the key.
 */
export function useInboxPreviewPrefetch(groupId: string) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const environments = useEnvironmentsFromUrl();
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

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
