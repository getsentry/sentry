import {Fragment, useState} from 'react';
import uniqBy from 'lodash/uniqBy';

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
  // For inline forms, the mappingKey will be the external name (since multiple will be rendered at one time)
  // For the modal form, the mappingKey will be this.modalMappingKey (since only one modal form is rendered at any time)
  const [queryResults, setQueryResults] = useState<Record<string, Team[]>>({});
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
    refetchTeams();
    refetchInitialResults();
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

  const modalMappingKey = '__MODAL_RESULTS__';

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
    const fieldResults =
      queryResults[mapping.externalName] ?? queryResults[modalMappingKey];
    const team =
      // First, search for the team in the query results...
      fieldResults?.find(item => item.id === mapping.teamId) ??
      // Then in the initial results, if nothing was found.
      initialResults?.find(item => item.id === mapping.teamId);
    return `/teams/${organization.slug}/${team?.slug ?? ''}/external-teams/`;
  };

  /**
   * This method combines the results from searches made on a form dropping repeated entries
   * that have identical 'id's. This is because we need the result of the search query when
   * the user submits to get the team slug, but it won't always be the last query they've made.
   *
   * If they search (but not select) after making a selection, and we didn't keep a running collection of results,
   * we wouldn't have the team to generate the endpoint from.
   */
  const combineResultsById = (resultList1: any, resultList2: any) => {
    return uniqBy([...resultList1, ...resultList2], 'id');
  };

  const handleResults = (results: any, mappingKey?: string) => {
    if (mappingKey) {
      setQueryResults({
        ...queryResults,
        // Ensure we always have a team to pull the slug from
        [mappingKey]: combineResultsById(results, queryResults[mappingKey] ?? []),
      });
    }
  };

  const onCreate = (mapping?: ExternalActorMappingOrSuggestion) => {
    openModal(({Body, Header, closeModal}) => (
      <Fragment>
        <Header closeButton>{t('Configure External Team Mapping')}</Header>
        <Body>
          <IntegrationExternalMappingForm
            type="team"
            integration={integration}
            dataEndpoint={ORGANIZATION_TEAMS_ENDPOINT}
            getBaseFormEndpoint={map => getBaseFormEndpoint(map)}
            defaultOptions={defaultTeamOptions()}
            mapping={mapping}
            mappingKey={modalMappingKey}
            sentryNamesMapper={sentryNamesMapper}
            onCancel={closeModal}
            onResults={handleResults}
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
    <IntegrationExternalMappings
      type="team"
      integration={integration}
      mappings={mappings()}
      dataEndpoint={ORGANIZATION_TEAMS_ENDPOINT}
      getBaseFormEndpoint={mapping => getBaseFormEndpoint(mapping)}
      defaultOptions={defaultTeamOptions()}
      sentryNamesMapper={sentryNamesMapper}
      onCreate={onCreate}
      onDelete={handleDelete}
      pageLinks={teamsPageLinks}
      onResults={handleResults}
    />
  );
}

export default IntegrationExternalTeamMappings;
