import {useCallback} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * Invalidates the endpoints that report an issue's autofix progress from the
 * outside, rather than the run state itself.
 *
 * These back the pages the Seer chat panel slides over, so they stay mounted
 * holding whatever they last fetched, and only the workflows overview polls —
 * for its `status` expand alone. Without this, a run that finishes under the
 * panel leaves the inbox showing the issue in its old bucket until the reader
 * navigates or refocuses the window.
 *
 * `apiOptions` puts the resolved URL first in the query key, so matching on the
 * URL alone reaches every filter, sort, cursor and expand variant these pages
 * mount. That breadth is deliberate — the panel can't see which page is behind
 * it — and it does sweep in other readers of the same endpoints, such as the
 * feedback inbox and the dashboard issue widget. They refetch a list they were
 * already showing, which is cheaper than working out which one is on screen.
 */
export function useRefreshAutofixProgressQueries(groupId: string) {
  const queryClient = useQueryClient();
  const organization = useOrganization();

  return useCallback(() => {
    const path = {organizationIdOrSlug: organization.slug};

    const urls = [
      // The inbox sections, bucketed and sorted on `issue.progress:`, which each
      // completed step advances. Not the legacy issue stream — that reads
      // through GroupStore and IssueListCacheStore, which this cannot reach.
      getApiUrl('/organizations/$organizationIdOrSlug/issues/', {path}),
      // Counts on the inbox's my / my teams / all tabs.
      getApiUrl('/organizations/$organizationIdOrSlug/issues-count/', {path}),
      // Pull request badge on the inbox row, filled in once a PR is opened.
      getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/pull-requests/', {
        path: {...path, issueId: groupId},
      }),
      // Seer workflows overview cards, including the issue stats and project
      // config expands that never poll.
      getApiUrl('/organizations/$organizationIdOrSlug/seer/autofix-overview/', {path}),
    ];

    for (const url of urls) {
      queryClient.invalidateQueries({queryKey: [url]});
    }
  }, [groupId, organization.slug, queryClient]);
}
