import {useEffect} from 'react';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {
  getDatetimeFromState,
  normalizeDateTimeString,
} from 'sentry/components/organizations/pageFilters/parse';
import {getPageFilterStorage} from 'sentry/components/organizations/pageFilters/persistence';
import type {Organization, SavedQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {useApiQuery, useQueryClient, type ApiQueryKey} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import usePrevious from 'sentry/utils/usePrevious';
import {getSavedQueryWithDataset} from 'sentry/views/discover/savedQuery/utils';

import {Results} from './results';

function makeDiscoverHomepageQueryKey(organization: Organization): ApiQueryKey {
  return [`/organizations/${organization.slug}/discover/homepage/`];
}

function Homepage() {
  const organization = useOrganization();
  const api = useApi();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const {selection} = usePageFilters();
  const {data, isLoading, isError, refetch} = useApiQuery<SavedQuery>(
    makeDiscoverHomepageQueryKey(organization),
    {
      staleTime: 0,
      enabled: organization.features.includes('discover-query'),
    }
  );

  const savedQuery = getSavedQueryWithDataset(data);

  const previousSavedQuery = usePrevious(savedQuery);

  useEffect(() => {
    const hasFetchedSavedQuery = !previousSavedQuery && savedQuery;
    const sidebarClicked = savedQuery && location.search === '';
    const hasValidEventViewInURL = EventView.fromLocation(location).isValid();

    if (
      savedQuery &&
      ((hasFetchedSavedQuery && !hasValidEventViewInURL) || sidebarClicked)
    ) {
      const eventView = EventView.fromSavedQuery(savedQuery);
      const pageFilterState = getPageFilterStorage(organization.slug);
      let query = {
        ...eventView.generateQueryStringObject(),
      };

      // Handle locked filters explicitly because we can't expect
      // PageFilterContainer to properly overwrite stored filters
      // when pushing the homepage query to the URL
      if (pageFilterState?.pinnedFilters) {
        pageFilterState.pinnedFilters.forEach(pinnedFilter => {
          if (pinnedFilter === 'projects') {
            query.project = pageFilterState.state.project?.map(String);
          } else if (pinnedFilter === 'datetime') {
            const {period, start, end, utc} = getDatetimeFromState(pageFilterState.state);
            query = {
              ...query,
              statsPeriod: period ?? undefined,
              utc: utc?.toString(),
              start: normalizeDateTimeString(start),
              end: normalizeDateTimeString(end),
            };
          } else if (pinnedFilter === 'environments') {
            query.environment = pageFilterState.state.environment;
          } else {
            query[pinnedFilter] = pageFilterState.state[pinnedFilter];
          }
        });
      }

      navigate(
        {
          ...location,
          query: {
            ...query,
            queryDataset: savedQuery?.queryDataset,
          },
        },
        {replace: true}
      );
    }
  }, [savedQuery, location, previousSavedQuery, navigate, organization.slug]);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const setSavedQuery = (newSavedQuery?: SavedQuery) => {
    queryClient.setQueryData(makeDiscoverHomepageQueryKey(organization), newSavedQuery);
  };

  return (
    <Results
      api={api}
      loading={isLoading}
      location={location}
      navigate={navigate}
      organization={organization}
      selection={selection}
      setSavedQuery={setSavedQuery}
      isHomepage
      savedQuery={savedQuery}
    />
  );
}

export default function HomepageContainer() {
  return (
    <PageFiltersContainer skipInitializeUrlParams>
      <Homepage />
    </PageFiltersContainer>
  );
}
