import {skipToken, useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';

export type AuthOrganization = {
  authenticated: boolean;
  canRegister: boolean;
  joinRequestUrl: string | null;
  loginMethod: 'password' | 'sso';
  memberAuthenticated: boolean;
  organization: {
    avatarUrl: string | null;
    name: string;
    slug: string;
  };
  provider: {
    key: string;
    name: string;
  } | null;
  ssoRequired: boolean;
  warnings: string[];
};

export function useAuthOrganization(organizationSlug?: string) {
  return useQuery(
    apiOptions.as<AuthOrganization>()(
      '/auth/organizations/$organizationIdOrSlug/config/',
      {
        path: organizationSlug ? {organizationIdOrSlug: organizationSlug} : skipToken,
        staleTime: 0,
      }
    )
  );
}
