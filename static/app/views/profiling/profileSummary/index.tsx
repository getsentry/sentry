import {Fragment, useCallback, useEffect, useMemo} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Button} from 'sentry/components/button';
import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import SearchBar from 'sentry/components/events/searchBar';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {
  ProfilingBreadcrumbs,
  ProfilingBreadcrumbsProps,
} from 'sentry/components/profiling/profilingBreadcrumbs';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import SmartSearchBar, {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PageFilters, Project} from 'sentry/types';
import {defined, generateQueryWithTag} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {formatTagKey, isAggregateField} from 'sentry/utils/discover/fields';
import {useCurrentProjectFromRouteParam} from 'sentry/utils/profiling/hooks/useCurrentProjectFromRouteParam';
import {useProfileEvents} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {useProfileFilters} from 'sentry/utils/profiling/hooks/useProfileFilters';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import Tags from 'sentry/views/discover/tags';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import {DEFAULT_PROFILING_DATETIME_SELECTION} from 'sentry/views/profiling/utils';

import {ProfileSummaryContent} from './content';

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

  useEffect(() => {
    trackAdvancedAnalyticsEvent('profiling_views.profile_summary', {
      organization,
      project_platform: project?.platform,
      project_id: project?.id,
    });
    // ignore  currentProject so we don't block the analytics event
    // or fire more than once unnecessarily
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization]);

  const transaction = decodeScalar(props.location.query.transaction);

  const rawQuery = useMemo(
    () => decodeScalar(props.location.query.query, ''),
    [props.location.query.query]
  );

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

  const profilesAggregateQuery = useProfileEvents<'count()'>({
    fields: ['count()'],
    sort: {key: 'count()', order: 'desc'},
    referrer: 'api.profiling.profile-summary-table', // TODO
    query,
    enabled: profilingUsingTransactions,
  });

  const profilesCount = useMemo(() => {
    if (profilesAggregateQuery.status !== 'success') {
      return null;
    }

    return (profilesAggregateQuery.data?.[0]?.data?.[0]?.['count()'] as number) || null;
  }, [profilesAggregateQuery]);

  const filtersQuery = useMemo(() => {
    // To avoid querying for the filters each time the query changes,
    // do not pass the user query to get the filters.
    const search = new MutableSearch('');

    if (defined(transaction)) {
      search.setFilterValues('transaction_name', [transaction]);
    }

    return search.formatString();
  }, [transaction]);

  const profileFilters = useProfileFilters({
    query: filtersQuery,
    selection: props.selection,
    disabled: profilingUsingTransactions,
  });

  const transactionSummaryTarget =
    project &&
    transaction &&
    transactionSummaryRouteWithQuery({
      orgSlug: organization.slug,
      transaction,
      projectID: project.id,
      query: {query},
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
          projectSlug: project?.slug ?? '',
          query: props.location.query,
          transaction: transaction ?? '',
        },
      },
    ];
  }, [props.location.query, project?.slug, transaction]);

  const eventView = useMemo(() => {
    const _eventView = EventView.fromNewQueryWithLocation(
      {
        id: undefined,
        version: 2,
        name: transaction || '',
        fields: [],
        query,
        projects: project ? [parseInt(project.id, 10)] : [],
      },
      props.location
    );
    _eventView.additionalConditions.setFilterValues('has', ['profile.id']);
    return _eventView;
  }, [props.location, project, query, transaction]);

  function generateTagUrl(key: string, value: string) {
    return {
      ...props.location,
      query: generateQueryWithTag(props.location.query, {key: formatTagKey(key), value}),
    };
  }

  return (
    <SentryDocumentTitle
      title={t('Profiling \u2014 Profile Summary')}
      orgSlug={organization.slug}
    >
      <PageFiltersContainer
        shouldForceProject={defined(project)}
        forceProject={project}
        specificProjectSlugs={defined(project) ? [project.slug] : []}
        defaultSelection={
          profilingUsingTransactions
            ? {datetime: DEFAULT_PROFILING_DATETIME_SELECTION}
            : undefined
        }
      >
        <Layout.Page>
          {project && transaction && (
            <Fragment>
              <Layout.Header>
                <Layout.HeaderContent>
                  <ProfilingBreadcrumbs
                    organization={organization}
                    trails={breadcrumbTrails}
                  />
                  <Layout.Title>
                    {project ? (
                      <IdBadge
                        project={project}
                        avatarSize={28}
                        hideName
                        avatarProps={{hasTooltip: true, tooltip: project.slug}}
                      />
                    ) : null}
                    {transaction}
                  </Layout.Title>
                </Layout.HeaderContent>
                {transactionSummaryTarget && (
                  <Layout.HeaderActions>
                    <Button to={transactionSummaryTarget} size="sm">
                      {t('View Transaction Summary')}
                    </Button>
                  </Layout.HeaderActions>
                )}
              </Layout.Header>
              <Layout.Body>
                <Layout.Main fullWidth={!profilingUsingTransactions}>
                  <ActionBar>
                    <PageFilterBar condensed>
                      <EnvironmentPageFilter />
                      <DatePageFilter alignDropdown="left" />
                    </PageFilterBar>
                    {profilingUsingTransactions ? (
                      <SearchBar
                        searchSource="profile_summary"
                        organization={organization}
                        projectIds={eventView.project}
                        query={rawQuery}
                        onSearch={handleSearch}
                        maxQueryLength={MAX_QUERY_LENGTH}
                      />
                    ) : (
                      <SmartSearchBar
                        organization={organization}
                        hasRecentSearches
                        searchSource="profile_summary"
                        supportedTags={profileFilters}
                        query={rawQuery}
                        onSearch={handleSearch}
                        maxQueryLength={MAX_QUERY_LENGTH}
                      />
                    )}
                  </ActionBar>
                  <ProfileSummaryContent
                    location={props.location}
                    project={project}
                    selection={props.selection}
                    transaction={transaction}
                    query={query}
                  />
                </Layout.Main>
                {profilingUsingTransactions && (
                  <Layout.Side>
                    <Tags
                      generateUrl={generateTagUrl}
                      totalValues={profilesCount}
                      eventView={eventView}
                      organization={organization}
                      location={props.location}
                    />
                  </Layout.Side>
                )}
              </Layout.Body>
            </Fragment>
          )}
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const ActionBar = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-template-columns: min-content auto;
  margin-bottom: ${space(2)};
`;

export default withPageFilters(ProfileSummaryPage);
