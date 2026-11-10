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

  // Fresh cache namespaces keep prepared consent isolated across page mounts,
  // authentication completions, and retries.
  const instance = useId();
  const [revision, setRevision] = useState(0);

  // Undefined uses the bootstrap account; null records a completed logout.
  const [user, setUser] = useState<User | null>();
  const [needsAuthentication, setNeedsAuthentication] = useState(false);
  const [completedAuthenticationConfig, setCompletedAuthenticationConfig] =
    useState<AuthConfig>();

  const authConfig = useQuery({
    ...oauthAuthConfigQueryOptions(returnTo, `${instance}:${revision}`),
    enabled: needsAuthentication,
  });

  // Canceling MFA returns to login, which needs organization configuration.
  // Prepare both screens before revealing authentication so cancellation stays seamless.
  const authenticationConfig = authConfig.data;
  const organizationSlug =
    authenticationConfig && !('nextUri' in authenticationConfig)
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
      // redirect: false keeps ordinary logout inline, but SSO single logout may
      // still navigate to the provider. Continue only when logout stayed on this page.
      const didRedirect = await logout(api, {redirect: false});

      if (didRedirect) {
        return true;
      }

      setUser(null);

      const {json: config} = await queryClient.fetchQuery(
        oauthAuthConfigQueryOptions(returnTo, `${instance}:${revision}`)
      );

      if (!('nextUri' in config) && config.singleOrganizationSlug) {
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
