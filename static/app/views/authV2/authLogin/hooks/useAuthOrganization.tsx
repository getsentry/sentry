import {skipToken, useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';

export type AuthOrganization = {
  authenticated: boolean;
  canRegister: boolean;
  joinRequestUrl: string | null;
  loginMethod: 'password' | 'sso';
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
  userIsAuthenticated: boolean;
  warnings: string[];
};

export function useAuthOrganization(organizationSlug?: string) {
  return useQuery(
    apiOptions.as<AuthOrganization>()('/auth/organizations/$organizationSlug/', {
      path: organizationSlug ? {organizationSlug} : skipToken,
      staleTime: 0,
    })
  );
}
