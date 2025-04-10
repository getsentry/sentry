import {useMemo} from 'react';

import useConfiguration from 'sentry/components/devtoolbar/hooks/useConfiguration';
import useFetchApiData from 'sentry/components/devtoolbar/hooks/useFetchApiData';
import type {ApiEndpointQueryKey} from 'sentry/components/devtoolbar/types';
import type {Team} from 'sentry/types/organization';

interface Props {
  idOrSlug?: string;
}

export default function useTeams({idOrSlug}: Props, opts?: {enabled: boolean}) {
  const {organizationSlug} = useConfiguration();

  return useFetchApiData<Team[]>({
    queryKey: useMemo(
      (): ApiEndpointQueryKey => [
        'io.sentry.toolbar',
        `/organizations/${organizationSlug}/teams/`,
        {
          query: {
            query: `id:${idOrSlug}`,
          },
        },
      ],
      [idOrSlug, organizationSlug]
    ),
    gcTime: Infinity,
    enabled: opts?.enabled ?? true,
  });
}
