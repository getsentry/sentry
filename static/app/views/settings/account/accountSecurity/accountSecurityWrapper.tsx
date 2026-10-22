import {useCallback} from 'react';
import {Outlet, useOutletContext} from 'react-router';
import {useMutation, useQuery} from '@tanstack/react-query';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Authenticator} from 'sentry/types/auth';
import type {OrganizationSummary} from 'sentry/types/organization';
import type {UserEmail} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApi} from 'sentry/utils/useApi';
import {useParams} from 'sentry/utils/useParams';

const ENDPOINT = getApiUrl('/users/$userId/authenticators/', {path: {userId: 'me'}});

export default function AccountSecurityWrapper() {
  const api = useApi();
  const {authId} = useParams<{authId?: string}>();
  const {links} = useLegacyStore(ConfigStore);

  const orgRequest = useQuery(
    apiOptions.as<OrganizationSummary[]>()('/organizations/', {
      // Organizations span every region, so list them from the control silo
      host: links.sentryUrl,
      staleTime: 0,
    })
  );
  const emailsRequest = useQuery(
    apiOptions.as<UserEmail[]>()('/users/$userId/emails/', {
      path: {userId: 'me'},
      staleTime: 0,
    })
  );
  const authenticatorsRequest = useQuery(
    apiOptions.as<Authenticator[]>()('/users/$userId/authenticators/', {
      path: {userId: 'me'},
      staleTime: 0,
    })
  );

  const {refetch: refetchOrganizations} = orgRequest;
  const {refetch: refetchEmails} = emailsRequest;
  const {refetch: refetchAuthenticators} = authenticatorsRequest;
  const handleRefresh = useCallback(() => {
    refetchOrganizations();
    refetchAuthenticators();
    refetchEmails();
  }, [refetchOrganizations, refetchAuthenticators, refetchEmails]);

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
      context={{
        authenticators,
        countEnrolled,
        deleteDisabled,
        handleRefresh,
        hasVerifiedEmail,
        onDisable: disableAuthenticatorMutation.mutate,
        onRegenerateBackupCodes: regenerateBackupCodesMutation.mutate,
        orgsRequire2fa,
      }}
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
