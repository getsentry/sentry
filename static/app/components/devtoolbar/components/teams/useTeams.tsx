import {useMemo} from 'react';

import type {Team} from 'sentry/types/organization';

import useConfiguration from '../../hooks/useConfiguration';
import useFetchApiData from '../../hooks/useFetchApiData';
import type {ApiEndpointQueryKey} from '../../types';

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
