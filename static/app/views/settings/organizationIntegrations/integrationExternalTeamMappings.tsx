import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {
  ExternalActorMapping,
  ExternalActorMappingOrSuggestion,
  Integration,
} from 'sentry/types/integrations';
import type {Team} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {sentryNameToOption} from 'sentry/utils/integrationUtil';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import IntegrationExternalMappingForm from './integrationExternalMappingForm';
import IntegrationExternalMappings from './integrationExternalMappings';

type Props = {
  integration: Integration;
};

function IntegrationExternalTeamMappings(props: Props) {
  const {integration} = props;
  const organization = useOrganization();
  const location = useLocation();
  const api = useApi({persistInFlight: true});
  const ORGANIZATION_TEAMS_ENDPOINT = getApiUrl(
    '/organizations/$organizationIdOrSlug/teams/',
    {
      path: {organizationIdOrSlug: organization.slug},
    }
  );

  const query = {
    ...location.query,
    hasExternalTeams: 'true',
  };
  // We paginate on this query, since we're filtering by hasExternalTeams:true
  const {
    data: teams = [],
    refetch: refetchTeams,
    getResponseHeader,
    isPending: isTeamsPending,
    isError: isTeamsError,
  } = useApiQuery<Team[]>([ORGANIZATION_TEAMS_ENDPOINT, {query}], {staleTime: 0});
  const teamsPageLinks = getResponseHeader?.('Link') ?? '';
  // We use this query as defaultOptions to reduce identical API calls
  const {
    data: initialResults = [],
    refetch: refetchInitialResults,
    isPending: isInitialResultsPending,
    isError: isInitialResultsError,
  } = useApiQuery<Team[]>([ORGANIZATION_TEAMS_ENDPOINT], {staleTime: 0});

  const fetchData = () => {
    return Promise.all([refetchTeams(), refetchInitialResults()]);
  };

  if (isTeamsPending || isInitialResultsPending) {
    return <LoadingIndicator />;
  }
  if (isTeamsError || isInitialResultsError) {
    return <LoadingError onRetry={() => fetchData()} />;
  }

  const handleDelete = async (mapping: ExternalActorMapping) => {
    try {
      const team = teams.find(item => item.id === mapping.teamId);
      if (!team) {
        throw new Error('Cannot find correct team slug.');
      }
      const endpoint = `/teams/${organization.slug}/${team.slug}/external-teams/${mapping.id}/`;

      await api.requestPromise(endpoint, {
        method: 'DELETE',
      });
      // remove config and update state
      addSuccessMessage(t('Deletion successful'));
      fetchData();
    } catch {
      // no 4xx errors should happen on delete
      addErrorMessage(t('An error occurred'));
    }
  };

  const handleSubmitSuccess = () => {
    fetchData();
  };

  const mappings = () => {
    const externalTeamMappings = teams.reduce<ExternalActorMapping[]>((acc, team) => {
      const {externalTeams} = team;
      acc.push(
        ...externalTeams
          .filter(externalTeam => externalTeam.provider === integration.provider.key)
          .map(externalTeam => ({...externalTeam, sentryName: team.slug}))
      );
      return acc;
    }, []);
    return externalTeamMappings.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
  };

  const sentryNamesMapper = (currTeams: Team[]) => {
    return currTeams.map(({id, slug}) => ({id, name: slug}));
  };

  const defaultTeamOptions = () => {
    return sentryNamesMapper(initialResults).map(sentryNameToOption);
  };

  const getBaseFormEndpoint = (mapping?: ExternalActorMappingOrSuggestion) => {
    if (!mapping) {
      return '';
    }
    const team = initialResults?.find(item => item.id === mapping.teamId);
    return `/teams/${organization.slug}/${team?.slug ?? ''}/external-teams/`;
  };

  const onCreate = (mapping?: ExternalActorMappingOrSuggestion) => {
    openModal(modalProps => (
      <IntegrationExternalMappingForm
        {...modalProps}
        type="team"
        integration={integration}
        getBaseFormEndpoint={map => getBaseFormEndpoint(map)}
        defaultOptions={defaultTeamOptions()}
        mapping={mapping}
        onSubmitSuccess={handleSubmitSuccess}
      />
    ));
  };

  return (
    <IntegrationExternalMappings
      type="team"
      integration={integration}
      mappings={mappings()}
      getBaseFormEndpoint={mapping => getBaseFormEndpoint(mapping)}
      defaultOptions={defaultTeamOptions()}
      onCreate={onCreate}
      onDelete={handleDelete}
      onSubmitSuccess={async () => {
        await fetchData();
      }}
      pageLinks={teamsPageLinks}
    />
  );
}

export default IntegrationExternalTeamMappings;
