import {useMemo} from 'react';

import useConfiguration from 'sentry/components/devtoolbar/hooks/useConfiguration';
import useFetchInfiniteApiData from 'sentry/components/devtoolbar/hooks/useFetchInfiniteApiData';
import type {ApiEndpointQueryKey} from 'sentry/components/devtoolbar/types';
import type {Group} from 'sentry/types/group';

interface Props {
  releaseVersion: string;
}

export default function useInfiniteReleaseIssuesList({releaseVersion}: Props) {
  const {environment, organizationSlug, projectId} = useConfiguration();

  return useFetchInfiniteApiData<Group[]>({
    queryKey: useMemo(
      (): ApiEndpointQueryKey => [
        'io.sentry.toolbar',
        `/organizations/${organizationSlug}/issues/`,
        {
          query: {
            limit: 6,
            queryReferrer: 'devtoolbar',
            environment: Array.isArray(environment) ? environment : [environment],
            project: projectId,
            statsPeriod: '14d',
            shortIdLookup: 0,
            query: `release:${releaseVersion} is:new`,
          },
        },
      ],
      [environment, organizationSlug, projectId, releaseVersion]
    ),
  });
}
