import {useHover} from '@react-aria/interactions';
import {useDebouncer} from '@tanstack/react-pacer';
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
  const prefetchDebouncer = useDebouncer(
    () => {
      void queryClient.prefetchQuery(
        groupApiOptions({
          groupId,
          organizationSlug: organization.slug,
          environments,
          expandDerivedData: organization.features.includes('issue-inbox'),
        })
      );
    },
    {wait: PREFETCH_DELAY_MS}
  );

  const {hoverProps} = useHover({
    onHoverStart: () => prefetchDebouncer.maybeExecute(),
    onHoverEnd: () => prefetchDebouncer.cancel(),
  });

  return hoverProps;
}
