import {useMemo} from 'react';

import type {Group} from 'sentry/types/group';
import {IssueCategory} from 'sentry/types/group';

import useConfiguration from '../../hooks/useConfiguration';
import useFetchInfiniteApiData from '../../hooks/useFetchInfiniteApiData';

interface Props {
  query: string;
}

export default function useInfiniteIssuesList({query}: Props) {
  const {environment, organizationSlug, projectId} = useConfiguration();
  const mailbox = 'unresolved';

  return useFetchInfiniteApiData<Group[]>({
    queryKey: useMemo(
      () => [
        `/organizations/${organizationSlug}/issues/`,
        {
          query: {
            limit: 25,
            queryReferrer: 'devtoolbar',
            environment: Array.isArray(environment) ? environment : [environment],
            project: projectId,
            statsPeriod: '14d',

            collapse: ['inbox'],
            expand: [
              'owners', // Gives us assignment
              'stats', // Gives us `firstSeen`
              // 'pluginActions', // Gives us plugin actions available
              // 'pluginIssues', // Gives us plugin issues available
              // 'integrationIssues', // Gives us integration issues available
              // 'sentryAppIssues', // Gives us Sentry app issues available
              // 'latestEventHasAttachments', // Gives us whether the feedback has screenshots
            ],
            shortIdLookup: 0,
            query: `issue.category:[${IssueCategory.ERROR},${IssueCategory.PERFORMANCE}] status:${mailbox} ${query}`,
          },
        },
      ],
      [environment, mailbox, organizationSlug, projectId, query]
    ),
  });
}
