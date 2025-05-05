import {useMemo} from 'react';

import useConfiguration from 'sentry/components/devtoolbar/hooks/useConfiguration';
import useFetchApiData from 'sentry/components/devtoolbar/hooks/useFetchApiData';
import type {ApiEndpointQueryKey} from 'sentry/components/devtoolbar/types';
import type {Incident} from 'sentry/views/alerts/types';

export default function useAlertsCount() {
  const {organizationSlug, projectId} = useConfiguration();

  return useFetchApiData<Incident[], number>({
    queryKey: useMemo(
      (): ApiEndpointQueryKey => [
        'io.sentry.toolbar',
        `/organizations/${organizationSlug}/incidents/`,
        {
          query: {
            limit: 1,
            queryReferrer: 'devtoolbar',
            project: [projectId],
            statusPeriod: '14d',
            status: 'open',
          },
        },
      ],
      [organizationSlug, projectId]
    ),
    select: (data): number => data.json.length,
  });
}
