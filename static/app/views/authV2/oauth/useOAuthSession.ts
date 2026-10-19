import {useCallback, useId, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {logout} from 'sentry/actionCreators/account';
import {ConfigStore} from 'sentry/stores/configStore';
import type {AuthConfig} from 'sentry/types/auth';
import type {User} from 'sentry/types/user';
import {useApi} from 'sentry/utils/useApi';
import {
  authOrganizationQueryOptions,
  useAuthOrganization,
} from 'sentry/views/authV2/authLogin/hooks/useAuthOrganization';
import type {AuthenticatedResult} from 'sentry/views/authV2/authLogin/types';

import {oauthAuthConfigQueryOptions} from './queries';

export function useOAuthSession(returnTo: string) {
  const queryClient = useQueryClient();
  const api = useApi({persistInFlight: true});
  const instance = useId();
  const [revision, setRevision] = useState(0);
  const [user, setUser] = useState<User | null>();
  const [needsAuthentication, setNeedsAuthentication] = useState(false);
  const [completedAuthenticationConfig, setCompletedAuthenticationConfig] =
    useState<AuthConfig>();
  const authConfig = useQuery({
    ...oauthAuthConfigQueryOptions(returnTo, `${instance}:${revision}`),
    enabled: needsAuthentication,
  });
  const authenticationConfig = authConfig.data;
  const organizationSlug =
    authenticationConfig &&
    !('nextUri' in authenticationConfig) &&
    !authenticationConfig.pendingMfa
      ? authenticationConfig.singleOrganizationSlug
      : undefined;
  const authenticationOrganization = useAuthOrganization(organizationSlug);
  const refresh = useCallback(() => {
    setCompletedAuthenticationConfig(undefined);
    setNeedsAuthentication(false);
    setRevision(value => value + 1);
  }, []);
  const onAuthenticated = useCallback(
    (result: AuthenticatedResult, config: AuthConfig) => {
      setUser(result.user);
      refresh();
      setCompletedAuthenticationConfig(config);
    },
    [refresh]
  );
  const requireAuthentication = useCallback(() => setNeedsAuthentication(true), []);
  const switchAccount = useMutation({
    onMutate: () => ({
      previousUser: user === undefined ? ConfigStore.get('user') : user,
    }),
    mutationFn: async () => {
      const didRedirect = await logout(api, {redirect: false});
      if (didRedirect) {
        return true;
      }

      setUser(null);
      const {json: config} = await queryClient.fetchQuery(
        oauthAuthConfigQueryOptions(returnTo, `${instance}:${revision}`)
      );
      if (!('nextUri' in config) && config.singleOrganizationSlug && !config.pendingMfa) {
        await queryClient.fetchQuery(
          authOrganizationQueryOptions(config.singleOrganizationSlug)
        );
      }
      return false;
    },
    onSuccess: didRedirect => {
      if (didRedirect) {
        return;
      }

      setNeedsAuthentication(true);
    },
  });

  return {
    authConfig,
    completedAuthenticationConfig,
    hasLoggedOut: user === null,
    isAuthenticationReady: !organizationSlug || !authenticationOrganization.isPending,
    needsAuthentication,
    onAuthenticated,
    refresh,
    requireAuthentication,
    sessionKey: `${instance}:${revision}`,
    switchAccount,
    user:
      (switchAccount.isPending || switchAccount.isError) && switchAccount.context
        ? switchAccount.context.previousUser
        : user === undefined
          ? ConfigStore.get('user')
          : user,
  };
}
