import {useCallback, useMemo} from 'react';
import {useMutation} from '@tanstack/react-query';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openRecoveryOptions} from 'sentry/actionCreators/modal';
import {
  fetchOrganizationByMember,
  fetchOrganizations,
} from 'sentry/actionCreators/organizations';
import {t} from 'sentry/locale';
import {OrganizationsStore} from 'sentry/stores/organizationsStore';
import type {Authenticator} from 'sentry/types/auth';
import {generateOrgSlugUrl} from 'sentry/utils';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getPendingInvite} from 'sentry/utils/getPendingInvite';
import {fetchMutation} from 'sentry/utils/queryClient';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';

interface UseAccountSecurityEnrollActionsOptions {
  authenticator: Authenticator | undefined;
}

export function useAccountSecurityEnrollActions({
  authenticator,
}: UseAccountSecurityEnrollActionsOptions) {
  const api = useApi();
  const navigate = useNavigate();
  const pendingInvitation = useMemo(() => getPendingInvite(), []);

  const authenticatorName = authenticator?.name ?? 'Authenticator';

  const {mutate: deleteAuthenticator} = useMutation({
    mutationFn: (authenticatorId: string) =>
      fetchMutation({
        url: getApiUrl('/users/$userId/authenticators/$authId/', {
          path: {userId: 'me', authId: authenticatorId},
        }),
        method: 'DELETE',
      }),
    onError: () => addErrorMessage(t('Error removing authenticator')),
    onSuccess: () => {
      navigate('/settings/account/security/');
      addSuccessMessage(t('Authenticator has been removed'));
    },
  });

  const completeEnrollment = useCallback(async () => {
    if (pendingInvitation) {
      await fetchOrganizationByMember(api, pendingInvitation.memberId.toString(), {
        addOrg: true,
        fetchOrgDetails: true,
      });
    }

    navigate('/settings/account/security/');
    openRecoveryOptions({authenticatorName});

    let organizations = OrganizationsStore.getAll();
    if (organizations.length === 0) {
      organizations = await fetchOrganizations(api, {member: '1'});
      OrganizationsStore.load(organizations);
    }

    if (organizations.length === 0) {
      return;
    }

    const currentOrigin = new URL(window.location.href).origin;
    const isAlreadyInOrganizationSubdomain = organizations.some(
      organization => organization.links.organizationUrl === currentOrigin
    );

    if (!isAlreadyInOrganizationSubdomain) {
      testableWindowLocation.assign(generateOrgSlugUrl(organizations[0]!.slug));
    }
  }, [api, authenticatorName, navigate, pendingInvitation]);

  return {
    completeEnrollment,
    deleteAuthenticator,
  };
}
