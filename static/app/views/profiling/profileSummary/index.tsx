import {useCallback, useMemo} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {LinkButton} from 'sentry/components/button';
import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import SearchBar from 'sentry/components/events/searchBar';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {AggregateFlamegraph} from 'sentry/components/profiling/flamegraph/aggregateFlamegraph';
import {
  ProfilingBreadcrumbs,
  ProfilingBreadcrumbsProps,
} from 'sentry/components/profiling/profilingBreadcrumbs';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import type {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, PageFilters, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {isAggregateField} from 'sentry/utils/discover/fields';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {useAggregateFlamegraphQuery} from 'sentry/utils/profiling/hooks/useAggregateFlamegraphQuery';
import {useCurrentProjectFromRouteParam} from 'sentry/utils/profiling/hooks/useCurrentProjectFromRouteParam';
import {useProfileFilters} from 'sentry/utils/profiling/hooks/useProfileFilters';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import {ProfilesSummaryChart} from 'sentry/views/profiling/landing/profilesSummaryChart';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {LegacySummaryPage} from 'sentry/views/profiling/profileSummary/legacySummaryPage';
import {DEFAULT_PROFILING_DATETIME_SELECTION} from 'sentry/views/profiling/utils';

import {MostRegressedProfileFunctions} from './regressedProfileFunctions';
import {SlowestProfileFunctions} from './slowestProfileFunctions';

interface ProfileSummaryHeaderProps {
  location: Location;
  organization: Organization;
  project: Project | null;
  query: string;
  transaction: string | undefined;
}
function ProfileSummaryHeader(props: ProfileSummaryHeaderProps) {
  const breadcrumbTrails: ProfilingBreadcrumbsProps['trails'] = useMemo(() => {
    return [
      {
        type: 'landing',
        payload: {
          query: props.location.query,
        },
      },
      {
        type: 'profile summary',
        payload: {
          projectSlug: props.project?.slug ?? '',
          query: props.location.query,
          transaction: props.transaction ?? '',
        },
      },
    ];
  }, [props.location.query, props.project?.slug, props.transaction]);

  const transactionSummaryTarget =
    props.project &&
    props.transaction &&
    transactionSummaryRouteWithQuery({
      orgSlug: props.organization.slug,
      transaction: props.transaction,
      projectID: props.project.id,
      query: {query: props.query},
    });

  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <ProfilingBreadcrumbs
          organization={props.organization}
          trails={breadcrumbTrails}
        />
        <Layout.Title>
          {props.project ? (
            <IdBadge
              hideName
              project={props.project}
              avatarSize={28}
              avatarProps={{hasTooltip: true, tooltip: props.project.slug}}
            />
          ) : null}
          {props.transaction}
        </Layout.Title>
      </Layout.HeaderContent>
      {transactionSummaryTarget && (
        <Layout.HeaderActions>
          <LinkButton to={transactionSummaryTarget} size="sm">
            {t('View Transaction Summary')}
          </LinkButton>
        </Layout.HeaderActions>
      )}
    </Layout.Header>
  );
}

interface ProfileFiltersProps {
  location: Location;
  organization: Organization;
  projectIds: EventView['project'];
  query: string;
  selection: PageFilters;
  transaction: string | undefined;
  usingTransactions: boolean;
}

function ProfileFilters(props: ProfileFiltersProps) {
  const filtersQuery = useMemo(() => {
    // To avoid querying for the filters each time the query changes,
    // do not pass the user query to get the filters.
    const search = new MutableSearch('');

    if (defined(props.transaction)) {
      search.setFilterValues('transaction_name', [props.transaction]);
    }

    return search.formatString();
  }, [props.transaction]);

  const profileFilters = useProfileFilters({
    query: filtersQuery,
    selection: props.selection,
    disabled: props.usingTransactions,
  });

  const handleSearch: SmartSearchBarProps['onSearch'] = useCallback(
    (searchQuery: string) => {
      browserHistory.push({
        ...props.location,
        query: {
          ...props.location.query,
          query: searchQuery || undefined,
          cursor: undefined,
        },
      });
    },
    [props.location]
  );

  return (
    <ActionBar>
      <PageFilterBar condensed>
        <EnvironmentPageFilter />
        <DatePageFilter alignDropdown="left" />
      </PageFilterBar>
      {props.usingTransactions ? (
        <SearchBar
          searchSource="profile_summary"
          organization={props.organization}
          projectIds={props.projectIds}
          query={props.query}
          onSearch={handleSearch}
          maxQueryLength={MAX_QUERY_LENGTH}
        />
      ) : (
        <SmartSearchBar
          organization={props.organization}
          hasRecentSearches
          searchSource="profile_summary"
          supportedTags={profileFilters}
          query={props.query}
          onSearch={handleSearch}
          maxQueryLength={MAX_QUERY_LENGTH}
        />
      )}
    </ActionBar>
  );
}

const ActionBar = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-template-columns: min-content auto;
  margin-bottom: ${space(2)};
`;

interface ProfileSummaryPageProps {
  location: Location;
  params: {
    projectId?: Project['slug'];
  };
  selection: PageFilters;
}

function ProfileSummaryPage(props: ProfileSummaryPageProps) {
  const organization = useOrganization();
  const project = useCurrentProjectFromRouteParam();

  const profilingUsingTransactions = organization.features.includes(
    'profiling-using-transactions'
  );

  const transaction = decodeScalar(props.location.query.transaction);
  const rawQuery = decodeScalar(props.location?.query?.query, '');

  const projectIds: number[] = useMemo(() => {
    if (!defined(project)) {
      return [];
    }

    const projects = parseInt(project.id, 10);
    if (isNaN(projects)) {
      return [];
    }

    return [projects];
  }, [project]);

  const projectSlugs: string[] = useMemo(() => {
    return defined(project) ? [project.slug] : [];
  }, [project]);

  const query = useMemo(() => {
    const search = new MutableSearch(rawQuery);

    if (defined(transaction)) {
      search.setFilterValues('transaction', [transaction]);
    }

    // there are no aggregations happening on this page,
    // so remove any aggregate filters
    Object.keys(search.filters).forEach(field => {
      if (isAggregateField(field)) {
        search.removeFilter(field);
      }
    });

    return search.formatString();
  }, [rawQuery, transaction]);

  const {data} = useAggregateFlamegraphQuery({transaction: transaction ?? ''});

  return (
    <SentryDocumentTitle
      title={t('Profiling \u2014 Profile Summary')}
      orgSlug={organization.slug}
    >
      <ProfileSummaryContainer>
        <PageFiltersContainer
          shouldForceProject={defined(project)}
          forceProject={project}
          specificProjectSlugs={projectSlugs}
          defaultSelection={
            profilingUsingTransactions
              ? {datetime: DEFAULT_PROFILING_DATETIME_SELECTION}
              : undefined
          }
        >
          <ProfileSummaryHeader
            organization={organization}
            location={props.location}
            project={project}
            query={query}
            transaction={transaction}
          />
          <ProfileFilters
            projectIds={projectIds}
            organization={organization}
            location={props.location}
            query={rawQuery}
            selection={props.selection}
            transaction={transaction}
            usingTransactions={profilingUsingTransactions}
          />
          <ProfilesSummaryChart
            referrer="api.profiling.profile-summary-chart"
            query={query}
            hideCount
          />
          <ProfileVisualizationContainer>
            <ProfileVisualization>
              <ProfileGroupProvider
                type="flamegraph"
                input={data ?? null}
                traceID=""
                frameFilter={undefined}
              >
                <FlamegraphStateProvider
                  initialState={{
                    preferences: {
                      sorting: 'alphabetical',
                    },
                  }}
                >
                  <FlamegraphThemeProvider>
                    <AggregateFlamegraph
                      hideToolbar
                      hideSystemFrames={false}
                      setHideSystemFrames={() => void 0}
                    />
                  </FlamegraphThemeProvider>
                </FlamegraphStateProvider>
              </ProfileGroupProvider>
            </ProfileVisualization>
            <ProfileDigest>
              <MostRegressedProfileFunctions transaction={transaction ?? ''} />
              <SlowestProfileFunctions transaction={transaction ?? ''} />
            </ProfileDigest>
          </ProfileVisualizationContainer>
        </PageFiltersContainer>
      </ProfileSummaryContainer>
    </SentryDocumentTitle>
  );
}

const ProfileVisualization = styled('div')`
  grid-area: visualization;
`;

const ProfileDigest = styled('div')`
  grid-area: digest;
`;

const ProfileVisualizationContainer = styled('div')`
  display: grid;
  grid-template-areas: 'visualization digest';
  flex: 1 1 100%;
`;

const ProfileSummaryContainer = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1 100%;

  /*
   * The footer component is a sibling of this div.
   * Remove it so the flamegraph can take up the
   * entire screen.
   */
  ~ footer {
    display: none;
  }
`;

export default function ProfileSummaryPageToggle(props: ProfileSummaryPageProps) {
  const organization = useOrganization();

  if (organization.features.includes('profiling-summary-redesign')) {
    return (
      <ProfileSummaryContainer data-test-id="profile-summary-redesign">
        <ProfileSummaryPage {...props} />
      </ProfileSummaryContainer>
    );
  }

  return (
    <div data-test-id="profile-summary-legacy">
      <LegacySummaryPage {...props} />
    </div>
  );
}
