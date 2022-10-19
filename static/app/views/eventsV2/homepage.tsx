import {browserHistory, InjectedRouter} from 'react-router';
import {Location} from 'history';

import {Client} from 'sentry/api';
import AsyncComponent from 'sentry/components/asyncComponent';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {Organization, PageFilters, SavedQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';

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

type HomepageQueryState = AsyncComponent['state'] & {
  savedQuery?: SavedQuery | null;
};

class HomepageQueryAPI extends AsyncComponent<Props, HomepageQueryState> {
  shouldReload = true;

  componentDidUpdate(prevProps, prevState) {
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
      browserHistory.replace(
        eventView.getResultsViewUrlTarget(this.props.organization.slug, true)
      );
    }
    super.componentDidUpdate(prevProps, prevState);
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization} = this.props;

    const endpoints: ReturnType<AsyncComponent['getEndpoints']> = [];
    if (
      organization.features.includes('discover-query-builder-as-landing-page') &&
      organization.features.includes('discover-query')
    ) {
      endpoints.push([
        'savedQuery',
        `/organizations/${organization.slug}/discover/homepage/`,
      ]);
    }
    return endpoints;
  }

  onRequestSuccess({stateKey, data}) {
    // No homepage query results in a 204, returning an empty string
    if (stateKey === 'savedQuery' && data === '') {
      this.setState({savedQuery: null});
    }
  }

  setSavedQuery = (newSavedQuery?: SavedQuery) => {
    this.setState({savedQuery: newSavedQuery});
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
    <PageFiltersContainer
      skipLoadLastUsed={props.organization.features.includes('global-views')}
      skipInitializeUrlParams
    >
      <HomepageQueryAPI {...props} />
    </PageFiltersContainer>
  );
}

export default withApi(withOrganization(withPageFilters(HomepageContainer)));
