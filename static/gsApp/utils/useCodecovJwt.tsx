import type {UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';

interface CodecovJWTResponse {
  token: string;
}

export function useCodecovJwt(
  orgSlug: string,
  options: Partial<UseApiQueryOptions<CodecovJWTResponse>> = {}
) {
  return useApiQuery<CodecovJWTResponse>([`/organizations/${orgSlug}/codecov-jwt/`], {
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    ...options,
  });
}

export function getCodecovJwtLink(
  source: string,
  jwtData?: CodecovJWTResponse
): string | undefined {
  if (!jwtData?.token) {
    return undefined;
  }

  const params = new URLSearchParams({
    state: jwtData.token,
    utm_medium: 'referral',
    utm_source: source,
    utm_campaign: 'sentry-codecov',
    utm_department: 'marketing',
  });
  return `https://app.codecov.io/login/?${params.toString()}`;
}
