import type {Location} from 'history';

import type {Client} from 'sentry/api';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {
  getDatetimeFromState,
  normalizeDateTimeString,
} from 'sentry/components/organizations/pageFilters/parse';
import {getPageFilterStorage} from 'sentry/components/organizations/pageFilters/persistence';
import type {PageFilters} from 'sentry/types/core';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization, SavedQuery} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import EventView from 'sentry/utils/discover/eventView';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import {getSavedQueryWithDataset} from 'sentry/views/discover/savedQuery/utils';

import {Results} from './results';

type Props = {
  api: Client;
  loading: boolean;
  location: Location;
  organization: Organization;
  router: InjectedRouter;
  selection: PageFilters;
  setSavedQuery: (savedQuery: SavedQuery) => void;
};

type HomepageQueryState = DeprecatedAsyncComponent['state'] & {
  savedQuery?: SavedQuery | null;
  starfishResult?: null;
};

class HomepageQueryAPI extends DeprecatedAsyncComponent<Props, HomepageQueryState> {
  shouldReload = true;

  componentDidUpdate(_, prevState) {
    const hasFetchedSavedQuery = !prevState.savedQuery && this.state.savedQuery;
    const hasInitiallyLoaded = prevState.loading && !this.state.loading;
    const sidebarClicked = this.state.savedQuery && this.props.location.search === '';
    const hasValidEventViewInURL = EventView.fromLocation(this.props.location).isValid();

    if (
      this.state.savedQuery &&
      ((hasInitiallyLoaded && hasFetchedSavedQuery && !hasValidEventViewInURL) ||
        sidebarClicked)
    ) {
      const eventView = EventView.fromSavedQuery(this.state.savedQuery);
      const pageFilterState = getPageFilterStorage(this.props.organization.slug);
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

      browserHistory.replace({
        ...this.props.location,
        query: {
          ...query,
          queryDataset: this.state.savedQuery?.queryDataset,
        },
      });
    }
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization} = this.props;

    const endpoints: ReturnType<DeprecatedAsyncComponent['getEndpoints']> = [];
    if (organization.features.includes('discover-query')) {
      endpoints.push([
        'savedQuery',
        `/organizations/${organization.slug}/discover/homepage/`,
      ]);
    }
    return endpoints;
  }

  onRequestSuccess({stateKey, data}) {
    const {organization} = this.props;
    // No homepage query results in a 204, returning an empty string
    if (stateKey === 'savedQuery' && data === '') {
      this.setState({savedQuery: null});
      return;
    }
    if (stateKey === 'savedQuery') {
      this.setState({
        savedQuery: organization.features.includes(
          'performance-discover-dataset-selector'
        )
          ? getSavedQueryWithDataset(data)
          : data,
      });
    }
  }

  setSavedQuery = (newSavedQuery?: SavedQuery) => {
    const {organization} = this.props;
    this.setState({
      savedQuery: organization.features.includes('performance-discover-dataset-selector')
        ? (getSavedQueryWithDataset(newSavedQuery) as SavedQuery)
        : newSavedQuery,
    });
  };

  renderBody(): React.ReactNode {
    const {savedQuery, loading} = this.state;

    return (
      <Results
        {...this.props}
        savedQuery={savedQuery ?? undefined}
        loading={loading}
        setSavedQuery={this.setSavedQuery}
        isHomepage
      />
    );
  }
}

function HomepageContainer(props: Props) {
  return (
    <PageFiltersContainer skipInitializeUrlParams>
      <HomepageQueryAPI {...props} />
    </PageFiltersContainer>
  );
}

export default withApi(withOrganization(withPageFilters(HomepageContainer)));
