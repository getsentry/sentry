import {useMemo} from 'react';

import type {Team} from 'sentry/types/organization';

import useConfiguration from '../../hooks/useConfiguration';
import useFetchApiData from '../../hooks/useFetchApiData';

interface Props {
  idOrSlug?: string;
}

export default function useTeams({idOrSlug}: Props, opts?: {enabled: boolean}) {
  const {organizationSlug} = useConfiguration();

  return useFetchApiData<Team[]>({
    queryKey: useMemo(
      () => [
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
    cacheTime: Infinity,
    enabled: opts?.enabled ?? true,
  });
}
