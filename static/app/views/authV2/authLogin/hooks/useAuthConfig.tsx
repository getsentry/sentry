import {useQuery} from '@tanstack/react-query';

import type {AuthConfigResponse} from 'sentry/types/auth';
import {apiOptions} from 'sentry/utils/api/apiOptions';

export function getAuthConfigQueryOptions(nextUri?: string) {
  return apiOptions.as<AuthConfigResponse>()('/auth/config/', {
    query: nextUri ? {next: nextUri} : undefined,
    staleTime: 0,
  });
}

export const authConfigQueryOptions = getAuthConfigQueryOptions();

export function useAuthConfig(nextUri?: string) {
  return useQuery(getAuthConfigQueryOptions(nextUri));
}
