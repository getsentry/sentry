import {useCallback, useMemo} from 'react';
import {skipToken, useQuery, useQueryClient} from '@tanstack/react-query';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {TeamStore} from 'sentry/stores/teamStore';
import type {AccessRequest} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import {OrganizationTeams} from './organizationTeams';

export default function OrganizationTeamsContainer() {
  const organization = useOrganization({allowNull: true});
  const queryClient = useQueryClient();

  const orgSlug = organization?.slug;
  const accessRequestsOptions = useMemo(
    () =>
      apiOptions.as<AccessRequest[]>()(
        '/organizations/$organizationIdOrSlug/access-requests/',
        {
          path: orgSlug ? {organizationIdOrSlug: orgSlug} : skipToken,
          staleTime: 0,
        }
      ),
    [orgSlug]
  );

  const {
    isPending,
    isError,
    data: requestList = [],
  } = useQuery({...accessRequestsOptions, retry: false});

  const handleRemoveAccessRequest = useCallback(
    (id: string, isApproved: boolean) => {
      const requestToRemove = requestList.find(request => request.id === id);
      const newRequestList = requestList.filter(request => request.id !== id);

      // Update the cache with the new value
      queryClient.setQueryData(accessRequestsOptions.queryKey, oldData => ({
        ...oldData,
        json: newRequestList,
        headers: oldData?.headers ?? {},
      }));

      // To be safer, trigger a refetch to ensure data is correct
      queryClient.invalidateQueries({queryKey: accessRequestsOptions.queryKey});

      if (isApproved && requestToRemove) {
        const team = requestToRemove.team;
        TeamStore.onUpdateSuccess(team.slug, {
          ...team,
          memberCount: team.memberCount + 1,
        });
      }
    },
    [requestList, accessRequestsOptions.queryKey, queryClient]
  );

  // Can't do anything if we don't have an organization
  if (!organization) {
    return <LoadingError message={t('Organization not found')} />;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError />;
  }

  return (
    <OrganizationTeams
      organization={organization}
      access={new Set(organization?.access)}
      features={new Set(organization?.features)}
      requestList={requestList}
      onRemoveAccessRequest={handleRemoveAccessRequest}
    />
  );
}
