import {Fragment} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {
  ExternalActorMapping,
  ExternalActorMappingOrSuggestion,
  ExternalUser,
  Integration,
} from 'sentry/types/integrations';
import type {Member} from 'sentry/types/organization';
import {sentryNameToOption} from 'sentry/utils/integrationUtil';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import IntegrationExternalMappingForm from './integrationExternalMappingForm';
import IntegrationExternalMappings from './integrationExternalMappings';

type Props = {
  integration: Integration;
};

function IntegrationExternalUserMappings(props: Props) {
  const {integration} = props;
  const organization = useOrganization();
  const api = useApi({persistInFlight: true});

  const DATA_ENDPOINT = `/organizations/${organization.slug}/members/`;
  const BASE_FORM_ENDPOINT = `/organizations/${organization.slug}/external-users/`;
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
    refetchMembers();
    refetchInitialResults();
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

  const sentryNamesMapper = (membersList: Member[]) => {
    return membersList
      .filter(member => member.user)
      .map(({user, email, name}) => {
        const label = email === name ? `${email}` : `${name} - ${email}`;
        return {id: user?.id!, name: label};
      });
  };

  const defaultUserOptions = sentryNamesMapper(initialResults).map(sentryNameToOption);

  const openMembersModal = (mapping?: ExternalActorMappingOrSuggestion) => {
    openModal(({Body, Header, closeModal}) => (
      <Fragment>
        <Header closeButton>{t('Configure External User Mapping')}</Header>
        <Body>
          <IntegrationExternalMappingForm
            type="user"
            integration={integration}
            dataEndpoint={DATA_ENDPOINT}
            getBaseFormEndpoint={() => BASE_FORM_ENDPOINT}
            defaultOptions={defaultUserOptions}
            mapping={mapping}
            sentryNamesMapper={sentryNamesMapper}
            onCancel={closeModal}
            onSubmitSuccess={() => {
              handleSubmitSuccess();
              closeModal();
            }}
          />
        </Body>
      </Fragment>
    ));
  };

  return (
    <Fragment>
      <IntegrationExternalMappings
        type="user"
        integration={integration}
        mappings={mappings()}
        dataEndpoint={DATA_ENDPOINT}
        getBaseFormEndpoint={() => BASE_FORM_ENDPOINT}
        defaultOptions={defaultUserOptions}
        sentryNamesMapper={sentryNamesMapper}
        onCreate={openMembersModal}
        onDelete={handleDelete}
        pageLinks={membersPageLinks}
      />
    </Fragment>
  );
}

export default IntegrationExternalUserMappings;
