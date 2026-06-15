import {skipToken, useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

type IssueProgressResponse = {
  results: Record<string, {progress: string}>;
};

export function useIssueProgress(groupIds: string[]) {
  const organization = useOrganization();

  return useQuery(
    apiOptions.as<IssueProgressResponse>()(
      '/organizations/$organizationIdOrSlug/issues-progress/',
      {
        path: groupIds.length ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {groups: groupIds},
        staleTime: 30_000,
      }
    )
  );
}
