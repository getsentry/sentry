import {Fragment} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
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
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

import {IntegrationExternalMappingForm} from './integrationExternalMappingForm';
import {IntegrationExternalMappings} from './integrationExternalMappings';

type Props = {
  integration: Integration;
};

export function IntegrationExternalUserMappings(props: Props) {
  const {integration} = props;
  const organization = useOrganization();
  const api = useApi({persistInFlight: true});

  const DATA_ENDPOINT = getApiUrl('/organizations/$organizationIdOrSlug/members/', {
    path: {organizationIdOrSlug: organization.slug},
  });
  const BASE_FORM_ENDPOINT = getApiUrl(
    '/organizations/$organizationIdOrSlug/external-users/',
    {
      path: {organizationIdOrSlug: organization.slug},
    }
  );
  // We paginate on this query, since we're filtering by hasExternalTeams:true
  const {
    data: members = [],
    refetch: refetchMembers,
    getResponseHeader,
    isPending: isMembersPending,
    isError: isMembersError,
  } = useApiQuery<Array<Member & {externalUsers: ExternalUser[]}>>(
    [DATA_ENDPOINT, {query: {query: 'hasExternalUsers:true', expand: 'externalUsers'}}],
    {staleTime: 0}
  );
  const membersPageLinks = getResponseHeader?.('Link') ?? '';
  // We use this query as defaultOptions to reduce identical API calls
  const {
    data: initialResults = [],
    refetch: refetchInitialResults,
    isPending: isInitialResultsPending,
    isError: isInitialResultsError,
  } = useApiQuery<Member[]>([DATA_ENDPOINT], {staleTime: 0});

  const fetchData = () => {
    return Promise.all([refetchMembers(), refetchInitialResults()]);
  };

  if (isMembersPending || isInitialResultsPending) {
    return <LoadingIndicator />;
  }
  if (isMembersError || isInitialResultsError) {
    return <LoadingError onRetry={() => fetchData()} />;
  }

  const handleDelete = async (mapping: ExternalActorMapping) => {
    try {
      await api.requestPromise(
        `/organizations/${organization.slug}/external-users/${mapping.id}/`,
        {
          method: 'DELETE',
        }
      );
      // remove config and update state
      addSuccessMessage(t('Deletion successful'));
      fetchData();
    } catch {
      // no 4xx errors should happen on delete
      addErrorMessage(t('An error occurred'));
    }
  };

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
        onDelete={handleDelete}
        onSubmitSuccess={async () => {
          await fetchData();
        }}
        pageLinks={membersPageLinks}
      />
    </Fragment>
  );
}
