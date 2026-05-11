import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useMutation} from '@tanstack/react-query';

import {useModal} from '@sentry/scraps/modal';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {
  ExternalActorMapping,
  ExternalActorMappingOrSuggestion,
  ExternalUser,
  Integration,
} from 'sentry/types/integrations';
import type {Member} from 'sentry/types/organization';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

import {IntegrationExternalMappingForm} from './integrationExternalMappingForm';
import {IntegrationExternalMappings} from './integrationExternalMappings';

type Props = {
  integration: Integration;
};

export function IntegrationExternalUserMappings(props: Props) {
  const {openModal} = useModal();

  const {integration} = props;
  const organization = useOrganization();

  const BASE_FORM_ENDPOINT = getApiUrl(
    '/organizations/$organizationIdOrSlug/external-users/',
    {
      path: {organizationIdOrSlug: organization.slug},
    }
  );
  // We paginate on this query, since we're filtering by hasExternalTeams:true
  const {
    data,
    refetch: refetchMembers,
    isPending: isMembersPending,
    isError: isMembersError,
  } = useQuery({
    ...apiOptions.as<Array<Member & {externalUsers: ExternalUser[]}>>()(
      '/organizations/$organizationIdOrSlug/members/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {query: 'hasExternalUsers:true', expand: 'externalUsers'},
        staleTime: 0,
      }
    ),
    select: selectJsonWithHeaders,
  });
  const members = data?.json ?? [];
  const membersPageLinks = data?.headers.Link ?? '';
  // We use this query as defaultOptions to reduce identical API calls
  const {
    data: initialResults = [],
    refetch: refetchInitialResults,
    isPending: isInitialResultsPending,
    isError: isInitialResultsError,
  } = useQuery(
    apiOptions.as<Member[]>()('/organizations/$organizationIdOrSlug/members/', {
      path: {organizationIdOrSlug: organization.slug},
      staleTime: 0,
    })
  );

  const fetchData = () => {
    return Promise.all([refetchMembers(), refetchInitialResults()]);
  };

  const deleteMutation = useMutation({
    mutationFn: (mapping: ExternalActorMapping) =>
      fetchMutation({
        url: `/organizations/${organization.slug}/external-users/${mapping.id}/`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      addSuccessMessage(t('Deletion successful'));
      fetchData();
    },
    onError: () => {
      addErrorMessage(t('An error occurred'));
    },
  });

  if (isMembersPending || isInitialResultsPending) {
    return <LoadingIndicator />;
  }
  if (isMembersError || isInitialResultsError) {
    return <LoadingError onRetry={() => fetchData()} />;
  }

  const handleSubmitSuccess = () => {
    // Don't bother updating state. The info is in array of objects for each object in another array of objects.
    // Easier and less error-prone to re-fetch the data and re-calculate state.
    fetchData();
  };

  const mappings = () => {
    const externalUserMappings = members.reduce<ExternalActorMapping[]>((acc, member) => {
      const {externalUsers, user} = member;

      acc.push(
        ...externalUsers
          .filter(externalUser => externalUser.provider === integration.provider.key)
          .map(externalUser => ({...externalUser, sentryName: user?.name ?? member.name}))
      );
      return acc;
    }, []);
    return externalUserMappings.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
  };

  const defaultUserOptions = initialResults
    .filter(member => member.user)
    .map(({user, email, name}) => {
      const label = email === name ? email : `${name} - ${email}`;
      return {
        value: {id: user?.id!, name: label},
        label,
      };
    });

  const openMembersModal = (mapping?: ExternalActorMappingOrSuggestion) => {
    openModal(modalProps => (
      <IntegrationExternalMappingForm
        {...modalProps}
        type="user"
        integration={integration}
        getBaseFormEndpoint={() => BASE_FORM_ENDPOINT}
        defaultOptions={defaultUserOptions}
        mapping={mapping}
        onSubmitSuccess={handleSubmitSuccess}
      />
    ));
  };

  return (
    <Fragment>
      <IntegrationExternalMappings
        type="user"
        integration={integration}
        mappings={mappings()}
        getBaseFormEndpoint={() => BASE_FORM_ENDPOINT}
        defaultOptions={defaultUserOptions}
        onCreate={openMembersModal}
        onDelete={deleteMutation.mutate}
        onSubmitSuccess={async () => {
          await fetchData();
        }}
        pageLinks={membersPageLinks}
      />
    </Fragment>
  );
}
