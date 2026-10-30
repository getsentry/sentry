import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';

export function useRepositories({orgSlug}: {orgSlug: string}) {
  return useQuery(
    apiOptions.contract('/organizations/$organizationIdOrSlug/repos/', {
      path: {organizationIdOrSlug: orgSlug},
      staleTime: Infinity,
    })
  );
}
