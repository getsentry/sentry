import {useMemo} from 'react';

import type {Group} from 'sentry/types/group';
import {IssueCategory} from 'sentry/types/group';

import useConfiguration from '../../hooks/useConfiguration';
import useFetchInfiniteApiData from '../../hooks/useFetchInfiniteApiData';
import type {ApiEndpointQueryKey} from '../../types';

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
