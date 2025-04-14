import {useMemo} from 'react';

import useConfiguration from 'sentry/components/devtoolbar/hooks/useConfiguration';
import useFetchInfiniteApiData from 'sentry/components/devtoolbar/hooks/useFetchInfiniteApiData';
import type {ApiEndpointQueryKey} from 'sentry/components/devtoolbar/types';
import type {Group} from 'sentry/types/group';
import {IssueCategory} from 'sentry/types/group';

interface Props {
  query: string;
}

export default function useInfiniteIssuesList({query}: Props) {
  const {environment, organizationSlug, projectId} = useConfiguration();
  const mailbox = 'unresolved';

  return useFetchInfiniteApiData<Group[]>({
    queryKey: useMemo(
      (): ApiEndpointQueryKey => [
        'io.sentry.toolbar',
        `/organizations/${organizationSlug}/issues/`,
        {
          query: {
            limit: 25,
            queryReferrer: 'devtoolbar',
            environment: Array.isArray(environment) ? environment : [environment],
            project: projectId,
            statsPeriod: '14d',
            shortIdLookup: 0,
            query: `issue.category:[${IssueCategory.ERROR},${IssueCategory.PERFORMANCE}] status:${mailbox} ${query}`,
          },
        },
      ],
      [environment, mailbox, organizationSlug, projectId, query]
    ),
  });
}
