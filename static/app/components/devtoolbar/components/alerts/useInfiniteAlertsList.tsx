import {useMemo} from 'react';

import useConfiguration from 'sentry/components/devtoolbar/hooks/useConfiguration';
import useFetchInfiniteApiData from 'sentry/components/devtoolbar/hooks/useFetchInfiniteApiData';
import type {ApiEndpointQueryKey} from 'sentry/components/devtoolbar/types';
import type {Incident} from 'sentry/views/alerts/types';

export default function useInfiniteFeedbackList() {
  const {organizationSlug, projectId} = useConfiguration();

  return useFetchInfiniteApiData<Incident[]>({
    queryKey: useMemo(
      (): ApiEndpointQueryKey => [
        'io.sentry.toolbar',
        `/organizations/${organizationSlug}/incidents/`,
        {
          query: {
            limit: 25,
            queryReferrer: 'devtoolbar',
            project: [projectId],
            statsPeriod: '14d',
            status: 'open',
          },
        },
      ],
      [organizationSlug, projectId]
    ),
  });
}
