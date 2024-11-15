import {useMemo} from 'react';

import type {Group} from 'sentry/types/group';

import useConfiguration from '../../hooks/useConfiguration';
import useFetchInfiniteApiData from '../../hooks/useFetchInfiniteApiData';
import type {ApiEndpointQueryKey} from '../../types';

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
