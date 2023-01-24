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
import {isAggregateField} from 'sentry/utils/discover/fields';
import {useCurrentProjectFromRouteParam} from 'sentry/utils/profiling/hooks/useCurrentProjectFromRouteParam';
import {useProfileFilters} from 'sentry/utils/profiling/hooks/useProfileFilters';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';

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
          cursor: undefined,
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
        <Layout.Page>
          <NoProjectMessage organization={organization}>
            {project && transaction && (
              <Fragment>
                <Layout.Header>
                  <Layout.HeaderContent>
                    <Breadcrumb
                      organization={organization}
                      trails={[
                        {
                          type: 'landing',
                          payload: {
                            query: props.location.query,
                          },
                        },
                        {
                          type: 'profile summary',
                          payload: {
                            projectSlug: project.slug,
                            query: props.location.query,
                            transaction,
                          },
                        },
                      ]}
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
