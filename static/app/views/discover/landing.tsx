import styled from '@emotion/styled';

import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import Feature from 'sentry/components/acl/feature';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Alert} from 'sentry/components/core/alert';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Switch} from 'sentry/components/core/switch';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import type {NewQuery, SavedQuery} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import EventView from 'sentry/utils/discover/eventView';
import {getDiscoverLandingUrl} from 'sentry/utils/discover/urls';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {makeDiscoverPathname} from 'sentry/views/discover/pathnames';
import {getSavedQueryWithDataset} from 'sentry/views/discover/savedQuery/utils';

import QueryList from './queryList';
import {getPrebuiltQueries} from './utils';

const SORT_OPTIONS = [
  {label: t('My Queries'), value: 'myqueries'},
  {label: t('Recently Edited'), value: '-dateUpdated'},
  {label: t('Query Name (A-Z)'), value: 'name'},
  {label: t('Date Created (Newest)'), value: '-dateCreated'},
  {label: t('Date Created (Oldest)'), value: 'dateCreated'},
  {label: t('Most Outdated'), value: 'dateUpdated'},
  {label: t('Most Popular'), value: 'mostPopular'},
  {label: t('Recently Viewed'), value: 'recentlyViewed'},
] as const satisfies Array<SelectValue<string>>;

function NoAccess() {
  return (
    <Layout.Page withPadding>
      <Alert.Container>
        <Alert variant="warning" showIcon={false}>
          {t("You don't have access to this feature")}
        </Alert>
      </Alert.Container>
    </Layout.Page>
  );
}

const useActiveSort = () => {
  const location = useLocation();
  const urlSort = decodeScalar(location.query.sort, 'myqueries');
  return SORT_OPTIONS.find(item => item.value === urlSort) || SORT_OPTIONS[0];
};

const useSavedSearchQuery = () => {
  const location = useLocation();
  return decodeScalar(location.query.query, '').trim();
};

const useDiscoverLandingQuery = (renderPrebuilt: boolean) => {
  const organization = useOrganization();
  const location = useLocation();
  const activeSort = useActiveSort();

  const views = getPrebuiltQueries(organization);
  const searchQuery = useSavedSearchQuery();

  const cursor = decodeScalar(location.query.cursor);
  let perPage = 9;

  if (!cursor && renderPrebuilt) {
    // invariant: we're on the first page

    if (searchQuery && searchQuery.length > 0) {
      const needleSearch = searchQuery.toLowerCase();

      const numOfPrebuiltQueries = views.reduce((sum, view) => {
        const newQuery = getSavedQueryWithDataset(view) as NewQuery;
        const eventView = EventView.fromNewQueryWithLocation(newQuery, location);

        // if a search is performed on the list of queries, we filter
        // on the pre-built queries
        if (eventView.name?.toLowerCase().includes(needleSearch)) {
          return sum + 1;
        }

        return sum;
      }, 0);

      perPage = Math.max(1, perPage - numOfPrebuiltQueries);
    } else {
      perPage = Math.max(1, perPage - views.length);
    }
  }

  const queryParams: (typeof location)['query'] = {
    cursor,
    query: `version:2 name:"${searchQuery}"`,
    per_page: perPage.toString(),
    sortBy: activeSort.value,
  };
  if (!cursor) {
    delete queryParams.cursor;
  }

  return useApiQuery<SavedQuery[]>(
    [
      `/organizations/${organization.slug}/discover/saved/`,
      {
        query: queryParams,
      },
    ],
    {
      staleTime: 0,
    }
  );
};

const RENDER_PREBUILT_KEY = 'discover-render-prebuilt';

function DiscoverLanding() {
  const organization = useOrganization();
  const location = useLocation();
  const activeSort = useActiveSort();
  const savedSearchQuery = useSavedSearchQuery();

  const [renderPrebuilt, setRenderPrebuilt] = useLocalStorageState(
    RENDER_PREBUILT_KEY,
    false
  );

  const {
    status,
    error,
    data: savedQueries = [],
    getResponseHeader,
    refetch: refreshSavedQueries,
  } = useDiscoverLandingQuery(renderPrebuilt);

  const savedQueriesPageLinks = getResponseHeader?.('Link');

  const to = makeDiscoverPathname({
    path: `/homepage/`,
    organization,
  });

  const handleSortChange = (value: string) => {
    trackAnalytics('discover_v2.change_sort', {organization, sort: value});
    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        sort: value,
      },
    });
  };

  const handleSearchQuery = (searchQuery: string) => {
    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        query: String(searchQuery).trim() || undefined,
      },
    });
  };

  return (
    <Feature
      organization={organization}
      features="discover-query"
      renderDisabled={() => <NoAccess />}
    >
      <SentryDocumentTitle title={t('Discover')} orgSlug={organization.slug}>
        <Layout.Page>
          <Layout.Header>
            <Layout.HeaderContent>
              <Breadcrumbs
                crumbs={[
                  {
                    label: t('Discover'),
                    to: getDiscoverLandingUrl(organization),
                  },
                  {
                    label: t('Saved Queries'),
                  },
                ]}
              />
            </Layout.HeaderContent>
            <Layout.HeaderActions>
              <LinkButton
                data-test-id="build-new-query"
                to={to}
                size="sm"
                priority="primary"
                onClick={() => {
                  trackAnalytics('discover_v2.build_new_query', {
                    organization,
                  });
                }}
              >
                {t('Build a new query')}
              </LinkButton>
            </Layout.HeaderActions>
          </Layout.Header>
          <Layout.Body>
            <Layout.Main width="full">
              <StyledActions>
                <StyledSearchBar
                  defaultQuery=""
                  query={savedSearchQuery}
                  placeholder={t('Search saved queries')}
                  onSearch={handleSearchQuery}
                />
                <PrebuiltSwitch>
                  Show Prebuilt
                  <Switch
                    checked={renderPrebuilt}
                    disabled={renderPrebuilt && savedQueries.length === 0}
                    size="lg"
                    onChange={() => setRenderPrebuilt(!renderPrebuilt)}
                  />
                </PrebuiltSwitch>
                <CompactSelect
                  trigger={triggerProps => (
                    <OverlayTrigger.Button {...triggerProps} prefix={t('Sort By')} />
                  )}
                  value={activeSort.value}
                  options={SORT_OPTIONS}
                  onChange={opt => handleSortChange(opt.value)}
                  position="bottom-end"
                />
              </StyledActions>
              {status === 'pending' ? (
                <LoadingIndicator />
              ) : status === 'error' ? (
                <LoadingError message={error.message} />
              ) : (
                <QueriesContainer>
                  {organization.features.includes('expose-migrated-discover-queries') && (
                    <Alert variant="info">
                      {tct(
                        'Your saved transactions queries are also available in the new Explore UI. Try them out in [exploreLink:Explore] instead.',
                        {
                          exploreLink: <Link to="/explore/saved-queries/" />,
                        }
                      )}
                    </Alert>
                  )}
                  <QueryList
                    pageLinks={savedQueriesPageLinks ?? ''}
                    savedQueries={savedQueries}
                    savedQuerySearchQuery={savedSearchQuery}
                    renderPrebuilt={renderPrebuilt}
                    location={location}
                    organization={organization}
                    refetchSavedQueries={refreshSavedQueries}
                  />
                </QueriesContainer>
              )}
            </Layout.Main>
          </Layout.Body>
        </Layout.Page>
      </SentryDocumentTitle>
    </Feature>
  );
}

const PrebuiltSwitch = styled('label')`
  display: flex;
  align-items: center;
  gap: ${space(1.5)};
  font-weight: ${p => p.theme.fontWeight.normal};
  margin: 0;
`;

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;

const StyledActions = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-template-columns: auto max-content min-content;
  align-items: center;
  margin-bottom: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: auto;
  }
`;

const QueriesContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};
`;

export default DiscoverLanding;
