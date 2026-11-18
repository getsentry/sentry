import {useQuery} from '@tanstack/react-query';

import type {AuthConfigResponse} from 'sentry/types/auth';
import {apiOptions} from 'sentry/utils/api/apiOptions';

export const authConfigQueryOptions = apiOptions.as<AuthConfigResponse>()(
  '/auth/config/',
  {staleTime: 0}
);

export function useAuthConfig() {
  return useQuery(authConfigQueryOptions);
}
