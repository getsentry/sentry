import {useMemo} from 'react';

import type {Group} from 'sentry/types/group';

import useConfiguration from '../../hooks/useConfiguration';
import useFetchInfiniteApiData from '../../hooks/useFetchInfiniteApiData';
import type {ApiEndpointQueryKey} from '../../types';

interface Props {
  query: string;
}

export default function useInfiniteIssuesList({query}: Props) {
  const {environment, organizationSlug, projectId} = useConfiguration();

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
            query,
          },
        },
      ],
      [environment, organizationSlug, projectId, query]
    ),
  });
}
