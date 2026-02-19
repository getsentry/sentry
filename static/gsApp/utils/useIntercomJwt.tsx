import getApiUrl from 'sentry/utils/api/getApiUrl';
import type {IntercomUserData} from 'sentry/utils/intercom';
import {useApiQuery} from 'sentry/utils/queryClient';

interface IntercomJwtResponse {
  jwt: string;
  userData: IntercomUserData;
}

/**
 * Hook to fetch a JWT for Intercom identity verification.
 *
 * The JWT is valid for 5 minutes, so we refresh it every 4 minutes
 * to ensure there's always a valid token available.
 */
export function useIntercomJwt(orgSlug: string, options: {enabled?: boolean} = {}) {
  return useApiQuery<IntercomJwtResponse>(
    [
      getApiUrl(`/organizations/$organizationIdOrSlug/intercom-jwt/`, {
        path: {organizationIdOrSlug: orgSlug},
      }),
    ],
    {
      staleTime: 4 * 60 * 1000, // 4 minutes (JWT valid for 5 min, refresh before expiry)
      retry: false,
      refetchOnWindowFocus: false,
      enabled: options.enabled ?? true,
    }
  );
}
