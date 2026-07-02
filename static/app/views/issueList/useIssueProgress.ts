import {skipToken, useQuery} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {ProgressState} from 'sentry/views/issueList/utils/progress';

type IssueProgressResponse = {
  results: Record<string, {progress: ProgressState}>;
};

export function useIssueProgress(groupIds: string[]) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  return useQuery(
    apiOptions.as<IssueProgressResponse>()(
      '/organizations/$organizationIdOrSlug/issues-progress/',
      {
        path: groupIds.length ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {groups: groupIds, project: selection.projects},
        staleTime: 30_000,
      }
    )
  );
}
