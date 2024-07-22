import {useMemo} from 'react';

import type {Incident} from 'sentry/views/alerts/types';

import useConfiguration from '../../hooks/useConfiguration';
import useFetchInfiniteApiData from '../../hooks/useFetchInfiniteApiData';
import type {ApiEndpointQueryKey} from '../../types';

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
