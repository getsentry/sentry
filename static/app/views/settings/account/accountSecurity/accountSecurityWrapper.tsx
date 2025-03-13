import {cloneElement, useCallback} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {fetchOrganizations} from 'sentry/actionCreators/organizations';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Authenticator} from 'sentry/types/auth';
import type {OrganizationSummary} from 'sentry/types/organization';
import type {UserEmail} from 'sentry/types/user';
import {defined} from 'sentry/utils';
import {useApiQuery, useMutation, useQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useParams} from 'sentry/utils/useParams';

const ENDPOINT = '/users/me/authenticators/';

interface Props {
  children: React.ReactElement;
}

function AccountSecurityWrapper({children}: Props) {
  const api = useApi();
  const {authId} = useParams<{authId?: string}>();

  const orgRequest = useQuery<OrganizationSummary[]>({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['organizations'],
    queryFn: () => fetchOrganizations(api),
    staleTime: 0,
  });
  const {refetch: refetchOrganizations} = orgRequest;
  const emailsRequest = useApiQuery<UserEmail[]>(['/users/me/emails/'], {staleTime: 0});
  const authenticatorsRequest = useApiQuery<Authenticator[]>([ENDPOINT], {staleTime: 0});

  const handleRefresh = useCallback(() => {
    refetchOrganizations();
    authenticatorsRequest.refetch();
    emailsRequest.refetch();
  }, [refetchOrganizations, authenticatorsRequest, emailsRequest]);

  const disableAuthenticatorMutation = useMutation({
    mutationFn: async (auth: Authenticator) => {
      if (!auth || !auth.authId) {
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
  const hasVerifiedEmail = !!emails.find(({isVerified}) => isVerified);

  // This happens when you switch between children views and the next child
  // view is lazy loaded, it can potentially be `null` while the code split
  // package is being fetched
  if (!defined(children)) {
    return null;
  }

  return cloneElement(children, {
    onDisable: disableAuthenticatorMutation.mutate,
    onRegenerateBackupCodes: regenerateBackupCodesMutation.mutate,
    authenticators,
    deleteDisabled,
    orgsRequire2fa,
    countEnrolled,
    hasVerifiedEmail,
    handleRefresh,
  });
}

export default AccountSecurityWrapper;
