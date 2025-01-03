import {useMemo} from 'react';

import type {SessionApiResponse} from 'sentry/types/organization';

import useConfiguration from 'sentry/components/devtoolbar/hooks/useConfiguration';
import useFetchApiData from 'sentry/components/devtoolbar/hooks/useFetchApiData';
import type {ApiEndpointQueryKey} from 'sentry/components/devtoolbar/types';

export default function useSessionStatus() {
  const {organizationSlug, projectId} = useConfiguration();
  return useFetchApiData<SessionApiResponse>({
    queryKey: useMemo(
      (): ApiEndpointQueryKey => [
        'io.sentry.toolbar',
        `/organizations/${organizationSlug}/sessions/`,
        {
          query: {
            queryReferrer: 'devtoolbar',
            project: [projectId],
            field: ['sum(session)'],
            interval: '10m',
            statsPeriod: '24h',
            groupBy: ['session.status'],
          },
        },
      ],
      [organizationSlug, projectId]
    ),
    gcTime: 5000,
  });
}
