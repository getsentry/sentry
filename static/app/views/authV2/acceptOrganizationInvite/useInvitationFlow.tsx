import {useState} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';

import {logout} from 'sentry/actionCreators/account';
import {ConfigStore} from 'sentry/stores/configStore';
import type {User} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {useApi} from 'sentry/utils/useApi';
import {authConfigQueryOptions} from 'sentry/views/authV2/authLogin/hooks/useAuthConfig';
import {useAuthOrganization} from 'sentry/views/authV2/authLogin/hooks/useAuthOrganization';
import type {AuthenticatedResult} from 'sentry/views/authV2/authLogin/types';

import {getInvitationStep} from './getInvitationStep';
import type {InviteDetails} from './types';

interface InvitationParams {
  memberId: string;
  orgId: string;
  token: string;
}

export function useInvitationFlow(params: InvitationParams) {
  const api = useApi({persistInFlight: true});
  // Undefined uses the bootstrap account; null marks a completed logout.
  const [authenticatedUser, setAuthenticatedUser] = useState<User | null>();
  const invitePath = {
    organizationIdOrSlug: params.orgId,
    memberId: params.memberId,
    token: params.token,
  };
  const inviteApiUrl = getApiUrl(
    '/accept-invite/$organizationIdOrSlug/$memberId/$token/',
    {path: invitePath}
  );
  const inviteQuery = useQuery({
    ...apiOptions.as<InviteDetails>()(
      '/accept-invite/$organizationIdOrSlug/$memberId/$token/',
      {path: invitePath, staleTime: Infinity}
    ),
    retry: false,
    refetchOnWindowFocus: query => (query.state.data?.json.needs2fa ? 'always' : false),
  });
  const inviteDetails = inviteQuery.data;
  const authOrganizationQuery = useAuthOrganization(inviteDetails?.orgSlug);
  const needsAccountAuthentication = Boolean(
    inviteDetails?.needsAuthentication && !inviteDetails.requireSso
  );
  const authConfigQuery = useQuery({
    ...authConfigQueryOptions,
    enabled: needsAccountAuthentication,
  });
  const loginConfig =
    authConfigQuery.data && !('nextUri' in authConfigQuery.data)
      ? authConfigQuery.data
      : undefined;
  const isLoadingAuthConfig = needsAccountAuthentication && authConfigQuery.isPending;
  const isInitialAuthConfigLoading =
    isLoadingAuthConfig && authenticatedUser === undefined;
  const isLoading =
    inviteQuery.isPending ||
    Boolean(inviteDetails?.orgSlug && authOrganizationQuery.isPending) ||
    isInitialAuthConfigLoading;

  const acceptMutation = useMutation({
    mutationFn: () => fetchMutation({url: inviteApiUrl, method: 'POST'}),
    onSuccess: () => {
      if (inviteDetails?.orgSlug) {
        testableWindowLocation.assign(`/${inviteDetails.orgSlug}/`);
      }
    },
  });

  const switchAccountMutation = useMutation({
    mutationFn: async () => {
      const didRedirect = await logout(api, {redirect: false});
      if (didRedirect) {
        return;
      }

      setAuthenticatedUser(null);
      acceptMutation.reset();
      await inviteQuery.refetch();
    },
  });

  const handleAuthenticated = async (result: AuthenticatedResult) => {
    setAuthenticatedUser(result.user);
    await inviteQuery.refetch();
  };

  const retryInvitation = async () => {
    await Promise.all([
      inviteQuery.refetch(),
      inviteDetails?.orgSlug ? authOrganizationQuery.refetch() : undefined,
      needsAccountAuthentication ? authConfigQuery.refetch() : undefined,
    ]);
  };

  const actions = {
    acceptInvitation: () => acceptMutation.mutate(),
    switchAccount: () => switchAccountMutation.mutate(),
    handleAuthenticated,
    retryInvitation,
  };
  const mutationState = {
    isAccepting: acceptMutation.isPending,
    hasAcceptError: acceptMutation.isError,
    isSwitchingAccount: switchAccountMutation.isPending,
    hasSwitchAccountError: switchAccountMutation.isError,
    isRetrying:
      inviteQuery.isFetching ||
      authOrganizationQuery.isFetching ||
      authConfigQuery.isFetching,
  };

  if (isLoading) {
    return {state: {...mutationState, status: 'loading'} as const, actions};
  }

  if (inviteQuery.isError) {
    const isInvalidInvite =
      inviteQuery.error instanceof RequestError &&
      (inviteQuery.error.status === 400 || inviteQuery.error.status === 404);

    if (isInvalidInvite) {
      return {state: {...mutationState, status: 'invalid'} as const, actions};
    }

    return {state: {...mutationState, status: 'unavailable'} as const, actions};
  }

  const authOrganization = authOrganizationQuery.data;
  if (
    !inviteDetails ||
    !authOrganization ||
    authOrganizationQuery.isError ||
    (needsAccountAuthentication && authConfigQuery.isError)
  ) {
    return {state: {...mutationState, status: 'unavailable'} as const, actions};
  }

  const sessionUser =
    authenticatedUser === undefined ? ConfigStore.get('user') : authenticatedUser;
  const signedInUser =
    inviteDetails.needsAuthentication || switchAccountMutation.isPending
      ? null
      : sessionUser;
  const step = getInvitationStep(
    inviteDetails,
    switchAccountMutation.isPending ||
      isLoadingAuthConfig ||
      Boolean(authenticatedUser && inviteQuery.isFetching)
  );

  return {
    state: {
      ...mutationState,
      status: 'ready',
      authOrganization,
      loginConfig,
      initialEmail: inviteDetails.inviteEmail ?? '',
      signedInUser,
      step,
    } as const,
    actions,
  };
}
