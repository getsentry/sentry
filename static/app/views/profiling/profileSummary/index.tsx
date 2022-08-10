import {Fragment, useCallback, useEffect, useMemo} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {Breadcrumb} from 'sentry/components/profiling/breadcrumb';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import SmartSearchBar, {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {PageFilters, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {useProfileFilters} from 'sentry/utils/profiling/hooks/useProfileFilters';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import withPageFilters from 'sentry/utils/withPageFilters';

import {ProfileSummaryContent} from './content';

interface ProfileSummaryPageProps {
  location: Location;
  params: {
    projectId?: Project['slug'];
  };
  selection?: PageFilters;
}

function ProfileSummaryPage(props: ProfileSummaryPageProps) {
  const organization = useOrganization();
  const {projects} = useProjects({
    slugs: defined(props.params.projectId) ? [props.params.projectId] : [],
  });

  useEffect(() => {
    trackAdvancedAnalyticsEvent('profiling_views.profile_summary', {
      organization,
    });
  }, [organization]);

  // Extract the project matching the provided project slug,
  // if it doesn't exist, set this to null and handle it accordingly.
  const project = projects.length === 1 ? projects[0] : null;

  const transaction = decodeScalar(props.location.query.transaction);

  const rawQuery = useMemo(
    () => decodeScalar(props.location.query.query, ''),
    [props.location.query.query]
  );

  const query = useMemo(() => {
    const search = new MutableSearch(rawQuery);

    if (defined(transaction)) {
      search.setFilterValues('transaction_name', [transaction]);
    }

    return search.formatString();
  }, [rawQuery, transaction]);

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
  });

  const handleSearch: SmartSearchBarProps['onSearch'] = useCallback(
    (searchQuery: string) => {
      browserHistory.push({
        ...props.location,
        query: {
          ...props.location.query,
          query: searchQuery || undefined,
        },
      });
    },
    [props.location]
  );

  return (
    <SentryDocumentTitle
      title={t('Profiling \u2014 Profile Summary')}
      orgSlug={organization.slug}
    >
      <PageFiltersContainer
        shouldForceProject={defined(project)}
        forceProject={project}
        specificProjectSlugs={defined(project) ? [project.slug] : []}
      >
        <NoProjectMessage organization={organization}>
          {project && transaction && (
            <Fragment>
              <Layout.Header>
                <Layout.HeaderContent>
                  <Breadcrumb
                    location={props.location}
                    organization={organization}
                    trails={[
                      {type: 'landing'},
                      {
                        type: 'profile summary',
                        payload: {
                          projectSlug: project.slug,
                          transaction,
                        },
                      },
                    ]}
                  />
                  <Layout.Title>
                    <Title>
                      <IdBadge
                        project={project}
                        avatarSize={28}
                        hideName
                        avatarProps={{hasTooltip: true, tooltip: project.slug}}
                      />
                      {transaction}
                    </Title>
                  </Layout.Title>
                </Layout.HeaderContent>
              </Layout.Header>
              <Layout.Body>
                <Layout.Main fullWidth>
                  <ActionBar>
                    <PageFilterBar condensed>
                      <EnvironmentPageFilter />
                      <DatePageFilter alignDropdown="left" />
                    </PageFilterBar>
                    <SmartSearchBar
                      organization={organization}
                      hasRecentSearches
                      searchSource="profile_summary"
                      supportedTags={profileFilters}
                      query={rawQuery}
                      onSearch={handleSearch}
                      maxQueryLength={MAX_QUERY_LENGTH}
                    />
                  </ActionBar>
                  <ProfileSummaryContent
                    location={props.location}
                    project={project}
                    selection={props.selection}
                    transaction={transaction}
                    query={query}
                  />
                </Layout.Main>
              </Layout.Body>
            </Fragment>
          )}
        </NoProjectMessage>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const Title = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const ActionBar = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-template-columns: min-content auto;
  margin-bottom: ${space(2)};
`;

export default withPageFilters(ProfileSummaryPage);
