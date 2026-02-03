import {useCallback, useEffect, useMemo} from 'react';

import {loadStats} from 'sentry/actionCreators/projects';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import TeamStore from 'sentry/stores/teamStore';
import type {AccessRequest} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import OrganizationTeams from './organizationTeams';

export default function OrganizationTeamsContainer() {
  const api = useApi();
  const organization = useOrganization({allowNull: true});
  const queryClient = useQueryClient();

  const queryKey = useMemo(
    () =>
      [
        getApiUrl(`/organizations/$organizationIdOrSlug/access-requests/`, {
          path: {organizationIdOrSlug: organization?.slug!},
        }),
      ] as const,
    [organization?.slug]
  );

  const {
    isPending,
    isError,
    data: requestList = [],
  } = useApiQuery<AccessRequest[]>(queryKey, {
    staleTime: 0,
    retry: false,
    enabled: !!organization?.slug,
  });

  useEffect(() => {
    if (!organization?.slug) {
      return;
    }
    loadStats(api, {
      orgId: organization?.slug,
      query: {
        since: (Date.now() / 1000 - 3600 * 24).toString(),
        stat: 'generated',
        group: 'project',
      },
    });
  }, [organization?.slug, api]);

  const handleRemoveAccessRequest = useCallback(
    (id: string, isApproved: boolean) => {
      const requestToRemove = requestList.find(request => request.id === id);
      const newRequestList = requestList.filter(request => request.id !== id);

      // Update the cache with the new value
      setApiQueryData(queryClient, queryKey, newRequestList);

      // To be safer, trigger a refetch to ensure data is correct
      queryClient.invalidateQueries({queryKey});

      if (isApproved && requestToRemove) {
        const team = requestToRemove.team;
        TeamStore.onUpdateSuccess(team.slug, {
          ...team,
          memberCount: team.memberCount + 1,
        });
      }
    },
    [requestList, queryKey, queryClient]
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
