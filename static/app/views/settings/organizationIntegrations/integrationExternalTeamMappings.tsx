import {useQuery} from '@tanstack/react-query';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {
  ExternalActorMapping,
  ExternalActorMappingOrSuggestion,
  Integration,
} from 'sentry/types/integrations';
import type {Team} from 'sentry/types/organization';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

import {IntegrationExternalMappingForm} from './integrationExternalMappingForm';
import {IntegrationExternalMappings} from './integrationExternalMappings';

type Props = {
  integration: Integration;
};

export function IntegrationExternalTeamMappings(props: Props) {
  const {integration} = props;
  const organization = useOrganization();
  const location = useLocation();
  // We paginate on this query, since we're filtering by hasExternalTeams:true
  const {
    data: teamsResponse,
    refetch: refetchTeams,
    isPending: isTeamsPending,
    isError: isTeamsError,
  } = useQuery({
    ...apiOptions.as<Team[]>()('/organizations/$organizationIdOrSlug/teams/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {...location.query, hasExternalTeams: 'true'},
      staleTime: 0,
    }),
    select: selectJsonWithHeaders,
  });
  const teams = teamsResponse?.json ?? [];
  const teamsPageLinks = teamsResponse?.headers.Link ?? '';
  // We use this query as defaultOptions to reduce identical API calls
  const {
    data: initialResults = [],
    refetch: refetchInitialResults,
    isPending: isInitialResultsPending,
    isError: isInitialResultsError,
  } = useQuery(
    apiOptions.as<Team[]>()('/organizations/$organizationIdOrSlug/teams/', {
      path: {organizationIdOrSlug: organization.slug},
      staleTime: 0,
    })
  );

  const fetchData = () => {
    return Promise.all([refetchTeams(), refetchInitialResults()]);
  };

  const deleteMutation = useMutation({
    mutationFn: (mapping: ExternalActorMapping) => {
      const team = teams.find(item => item.id === mapping.teamId);
      if (!team) {
        throw new Error('Cannot find correct team slug.');
      }
      return fetchMutation({
        url: `/teams/${organization.slug}/${team.slug}/external-teams/${mapping.id}/`,
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Deletion successful'));
      fetchData();
    },
    onError: () => {
      addErrorMessage(t('An error occurred'));
    },
  });

  if (isTeamsPending || isInitialResultsPending) {
    return <LoadingIndicator />;
  }
  if (isTeamsError || isInitialResultsError) {
    return <LoadingError onRetry={() => fetchData()} />;
  }

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

  const defaultTeamOptions = () => {
    return initialResults.map(({id, slug}) => ({
      value: {id, name: slug},
      label: slug,
    }));
  };

  const getBaseFormEndpoint = (mapping?: ExternalActorMappingOrSuggestion) => {
    if (!mapping) {
      return '';
    }
    // Search both initialResults and teams (filtered by hasExternalTeams).
    // Fall back to sentryName from the mutation data for teams found via search
    // that aren't in either list.
    const team =
      initialResults?.find(item => item.id === mapping.teamId) ??
      teams.find(item => item.id === mapping.teamId);
    const teamSlug = team?.slug ?? ('sentryName' in mapping ? mapping.sentryName : '');
    return `/teams/${organization.slug}/${teamSlug}/external-teams/`;
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
      onDelete={deleteMutation.mutate}
      onSubmitSuccess={async () => {
        await fetchData();
      }}
      pageLinks={teamsPageLinks}
    />
  );
}
