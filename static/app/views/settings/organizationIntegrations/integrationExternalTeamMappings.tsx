import {useDebouncedCallback} from '@tanstack/react-pacer';
import {keepPreviousData, skipToken, useMutation, useQuery} from '@tanstack/react-query';
import {parseAsString, useQueryStates} from 'nuqs';

import {Stack} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';
import {toast} from '@sentry/scraps/toast';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SearchBar} from 'sentry/components/searchBar';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {
  ExternalActorMapping,
  ExternalActorMappingOrSuggestion,
  Integration,
} from 'sentry/types/integrations';
import type {Team} from 'sentry/types/organization';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

import {IntegrationExternalMappingForm} from './integrationExternalMappingForm';
import {IntegrationExternalMappings} from './integrationExternalMappings';

type Props = {
  integration: Integration;
};

export function IntegrationExternalTeamMappings(props: Props) {
  const {openModal} = useModal();

  const {integration} = props;
  const organization = useOrganization();
  const [{cursor, query: searchQuery}, setSearchParams] = useQueryStates({
    cursor: parseAsString,
    query: parseAsString.withDefault(''),
  });
  const handleSearch = useDebouncedCallback(
    (value: string) => setSearchParams({query: value || null, cursor: null}),
    {wait: DEFAULT_DEBOUNCE_DURATION}
  );
  // We paginate on this query, since we're filtering by hasExternalTeams:true
  const {
    data: teamsResponse,
    refetch: refetchTeams,
    isPending: isTeamsPending,
    isError: isTeamsError,
  } = useQuery({
    ...apiOptions.as<Team[]>()('/organizations/$organizationIdOrSlug/teams/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        cursor: cursor ?? undefined,
        query: ['hasExternalTeams:true', searchQuery.trim()].filter(Boolean).join(' '),
      },
      staleTime: 0,
    }),
    select: selectJsonWithHeaders,
    placeholderData: keepPreviousData,
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

  // Search both initialResults and teams (filtered by hasExternalTeams).
  // Fall back to sentryName from the mutation data for teams found via search
  // that aren't in either list.
  const getTeamSlug = (mapping: ExternalActorMappingOrSuggestion) => {
    const team =
      initialResults.find(item => item.id === mapping.teamId) ??
      teams.find(item => item.id === mapping.teamId);
    return team?.slug ?? ('sentryName' in mapping ? mapping.sentryName : '');
  };

  const deleteMutation = useMutation({
    mutationFn: (mapping: ExternalActorMapping) => {
      const teamSlug = getTeamSlug(mapping);
      if (!teamSlug) {
        throw new Error('Cannot find correct team slug.');
      }
      return fetchMutation({
        url: getApiUrl(
          '/teams/$organizationIdOrSlug/$teamIdOrSlug/external-teams/$externalTeamId/',
          {
            path: {
              organizationIdOrSlug: organization.slug,
              teamIdOrSlug: teamSlug,
              externalTeamId: mapping.id,
            },
          }
        ),
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast.success(t('Deletion successful'));
      fetchData();
    },
    onError: () => {
      toast.error(t('An error occurred'));
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
      return getApiUrl('/teams/$organizationIdOrSlug/$teamIdOrSlug/external-teams/', {
        path: skipToken,
      });
    }
    const teamSlug = getTeamSlug(mapping);
    const externalTeamId = 'id' in mapping ? mapping.id : null;
    return externalTeamId
      ? getApiUrl(
          '/teams/$organizationIdOrSlug/$teamIdOrSlug/external-teams/$externalTeamId/',
          {
            path: {
              organizationIdOrSlug: organization.slug,
              teamIdOrSlug: teamSlug,
              externalTeamId,
            },
          }
        )
      : getApiUrl('/teams/$organizationIdOrSlug/$teamIdOrSlug/external-teams/', {
          path: {
            organizationIdOrSlug: organization.slug,
            teamIdOrSlug: teamSlug,
          },
        });
  };

  const onCreate = () => {
    openModal(modalProps => (
      <IntegrationExternalMappingForm
        {...modalProps}
        type="team"
        integration={integration}
        getBaseFormEndpoint={map => getBaseFormEndpoint(map)}
        defaultOptions={defaultTeamOptions()}
        onSubmitSuccess={handleSubmitSuccess}
      />
    ));
  };

  return (
    <Stack gap="md">
      <SearchBar
        placeholder={t('Search teams')}
        query={searchQuery}
        onChange={handleSearch}
      />
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
        searchQuery={searchQuery}
      />
    </Stack>
  );
}
