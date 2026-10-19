import type {AuthConfigResponse} from 'sentry/types/auth';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {normalizeQueryKey} from 'sentry/utils/api/apiQueryKey';

import type {
  AuthorizationConsent,
  AuthorizationParameters,
  DeviceConsent,
  DeviceContext,
  OAuthContext,
  OAuthRedirect,
} from './types';

const preparationPolicy = {
  gcTime: 0,
  refetchOnMount: false,
  refetchOnReconnect: false,
  refetchOnWindowFocus: false,
  retry: false,
} as const;

export function oauthAuthConfigQueryOptions(returnTo: string, sessionKey: string) {
  const options = apiOptions.as<AuthConfigResponse>()('/auth/config/', {
    query: {next: returnTo},
    allowAuthError: true,
    staleTime: 0,
  });
  const key = normalizeQueryKey(options.queryKey);
  return {
    ...options,
    queryKey: [key[0], key[1], {infinite: false, sessionKey}] as const,
    ...preparationPolicy,
  };
}

export function authorizationContextQueryOptions(query: AuthorizationParameters) {
  return {
    ...apiOptions.as<OAuthContext | OAuthRedirect>()('/auth/oauth/authorize/context/', {
      query,
      staleTime: 0,
      allowAuthError: true,
    }),
    ...preparationPolicy,
  };
}

export function authorizationConsentQueryOptions(
  query: AuthorizationParameters,
  sessionKey: string
) {
  const options = apiOptions.as<AuthorizationConsent | OAuthRedirect>()(
    '/auth/oauth/authorize/',
    {query, staleTime: 0, allowAuthError: true}
  );
  const key = normalizeQueryKey(options.queryKey);
  return {
    ...options,
    // Keep account-bound transactions isolated across authentication and page mounts.
    queryKey: [key[0], key[1], {infinite: false, sessionKey}] as const,
    ...preparationPolicy,
  };
}

export function deviceContextQueryOptions(userCode: string) {
  return {
    ...apiOptions.as<DeviceContext>()('/auth/oauth/device/context/', {
      query: {user_code: userCode},
      staleTime: 0,
      allowAuthError: true,
    }),
    ...preparationPolicy,
  };
}

export function deviceConsentQueryOptions(userCode: string, sessionKey: string) {
  const options = apiOptions.as<DeviceConsent>()('/auth/oauth/device/', {
    query: {user_code: userCode},
    staleTime: 0,
    allowAuthError: true,
  });
  const key = normalizeQueryKey(options.queryKey);
  return {
    ...options,
    queryKey: [key[0], key[1], {infinite: false, sessionKey}] as const,
    ...preparationPolicy,
  };
}
