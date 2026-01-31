import {useCallback} from 'react';
import {Outlet, useOutletContext} from 'react-router-dom';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {fetchOrganizations} from 'sentry/actionCreators/organizations';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Authenticator} from 'sentry/types/auth';
import type {OrganizationSummary} from 'sentry/types/organization';
import type {UserEmail} from 'sentry/types/user';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery, useMutation, useQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useParams} from 'sentry/utils/useParams';

const ENDPOINT = getApiUrl('/users/$userId/authenticators/', {path: {userId: 'me'}});

export default function AccountSecurityWrapper() {
  const api = useApi();
  const {authId} = useParams<{authId?: string}>();

  const orgRequest = useQuery<OrganizationSummary[]>({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['organizations'],
    queryFn: () => fetchOrganizations(api),
    staleTime: 0,
  });
  const {refetch: refetchOrganizations} = orgRequest;
  const emailsRequest = useApiQuery<UserEmail[]>(
    [getApiUrl('/users/$userId/emails/', {path: {userId: 'me'}})],
    {
      staleTime: 0,
    }
  );
  const authenticatorsRequest = useApiQuery<Authenticator[]>([ENDPOINT], {staleTime: 0});

  const handleRefresh = useCallback(() => {
    refetchOrganizations();
    authenticatorsRequest.refetch();
    emailsRequest.refetch();
  }, [refetchOrganizations, authenticatorsRequest, emailsRequest]);

  const disableAuthenticatorMutation = useMutation({
    mutationFn: async (auth: Authenticator) => {
      if (!auth?.authId) {
        return;
      }

      await api.requestPromise(`${ENDPOINT}${auth.authId}/`, {method: 'DELETE'});
    },
    onSuccess: () => {
      handleRefresh();
    },
    onError: (_, auth) => {
      addErrorMessage(t('Error disabling %s', auth.name));
    },
  });

  const regenerateBackupCodesMutation = useMutation({
    mutationFn: async () => {
      if (!authId) {
        return;
      }

      await api.requestPromise(`${ENDPOINT}${authId}/`, {
        method: 'PUT',
      });
    },
    onSuccess: () => {
      handleRefresh();
    },
    onError: () => {
      addErrorMessage(t('Error regenerating backup codes'));
    },
  });

  if (
    orgRequest.isPending ||
    emailsRequest.isPending ||
    authenticatorsRequest.isPending ||
    disableAuthenticatorMutation.isPending ||
    regenerateBackupCodesMutation.isPending
  ) {
    return <LoadingIndicator />;
  }

  if (authenticatorsRequest.isError || emailsRequest.isError || orgRequest.isError) {
    return <LoadingError onRetry={handleRefresh} />;
  }

  const authenticators = authenticatorsRequest.data;
  const emails = emailsRequest.data;
  const organizations = orgRequest.data;

  const enrolled =
    authenticators.filter(auth => auth.isEnrolled && !auth.isBackupInterface) || [];
  const countEnrolled = enrolled.length;
  const orgsRequire2fa = organizations.filter(org => org.require2FA) || [];
  const deleteDisabled = orgsRequire2fa.length > 0 && countEnrolled === 1;
  const hasVerifiedEmail = emails.some(({isVerified}) => isVerified);

  return (
    <Outlet
      context={
        {
          authenticators,
          countEnrolled,
          deleteDisabled,
          handleRefresh,
          hasVerifiedEmail,
          onDisable: disableAuthenticatorMutation.mutate,
          onRegenerateBackupCodes: regenerateBackupCodesMutation.mutate,
          orgsRequire2fa,
        } as OutletContext
      }
    />
  );
}

type OutletContext = {
  authenticators: Authenticator[] | null;
  countEnrolled: number;
  deleteDisabled: boolean;
  handleRefresh: () => void;
  hasVerifiedEmail: boolean;
  onDisable: (auth: Authenticator) => void;
  onRegenerateBackupCodes: () => void;
  orgsRequire2fa: OrganizationSummary[];
};

export function useAccountSecurityContext(): OutletContext {
  return useOutletContext<OutletContext>();
}
