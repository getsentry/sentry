import {useCallback, useEffect, useState} from 'react';
import type {RouteComponentProps} from 'react-router';

import {loadStats} from 'sentry/actionCreators/projects';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TeamStore from 'sentry/stores/teamStore';
import type {AccessRequest} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import OrganizationTeams from './organizationTeams';

export function OrganizationTeamsContainer(props: RouteComponentProps<{}, {}>) {
  const api = useApi();
  const organization = useOrganization();
  const [requestList, setRequestList] = useState<AccessRequest[]>([]);

  const {isLoading, isError} = useApiQuery<AccessRequest[]>(
    [`/organizations/${organization.slug}/access-requests/`],
    {
      staleTime: 0,
      retry: false,
      onSuccess: ([data]) => {
        setRequestList(data);
      },
    }
  );

  useEffect(() => {
    loadStats(api, {
      orgId: organization.slug,
      query: {
        since: (new Date().getTime() / 1000 - 3600 * 24).toString(),
        stat: 'generated',
        group: 'project',
      },
    });
  }, [organization.slug, api]);

  const handleRemoveAccessRequest = useCallback(
    (id: string, isApproved: boolean) => {
      const requestToRemove = requestList.find(request => request.id === id);
      setRequestList(requestList.filter(request => request.id !== id));
      if (isApproved && requestToRemove) {
        const team = requestToRemove.team;
        TeamStore.onUpdateSuccess(team.slug, {
          ...team,
          memberCount: team.memberCount + 1,
        });
      }
    },
    [requestList]
  );

  // can an organization be null here?
  if (!organization) {
    return null;
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError />;
  }

  return (
    <OrganizationTeams
      {...props}
      access={new Set(organization.access)}
      features={new Set(organization.features)}
      organization={organization}
      requestList={requestList}
      onRemoveAccessRequest={handleRemoveAccessRequest}
    />
  );
}

export default OrganizationTeamsContainer;
