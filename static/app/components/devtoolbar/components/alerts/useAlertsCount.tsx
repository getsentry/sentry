import {useMemo} from 'react';

import type {Incident} from 'sentry/views/alerts/types';

import useConfiguration from '../../hooks/useConfiguration';
import useFetchApiData from '../../hooks/useFetchApiData';
import type {ApiEndpointQueryKey} from '../../types';

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
