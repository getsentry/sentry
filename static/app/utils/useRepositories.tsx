import {useQuery} from '@tanstack/react-query';

import type {Repository} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';

export function useRepositories({orgSlug}: {orgSlug: string}) {
  return useQuery(
    apiOptions.as<Repository[]>()('/organizations/$organizationIdOrSlug/repos/', {
      path: {organizationIdOrSlug: orgSlug},
      staleTime: Infinity,
    })
  );
}
