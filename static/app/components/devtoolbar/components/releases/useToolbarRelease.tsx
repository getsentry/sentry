import {useMemo} from 'react';

import type {ApiEndpointQueryKey} from 'sentry/components/devtoolbar/types';
import type {Release} from 'sentry/types/release';

import useConfiguration from '../../hooks/useConfiguration';
import useFetchApiData from '../../hooks/useFetchApiData';

export default function useToolbarRelease() {
  const {organizationSlug, projectSlug} = useConfiguration();

  return useFetchApiData<Release[]>({
    queryKey: useMemo(
      (): ApiEndpointQueryKey => [
        'io.sentry.toolbar',
        `/organizations/${organizationSlug}/releases/`,
        {
          query: {
            queryReferrer: 'devtoolbar',
            projectSlug,
          },
        },
      ],
      [organizationSlug, projectSlug]
    ),
    gcTime: 5000,
  });
}
