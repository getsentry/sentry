import {InjectedRouter} from 'react-router';
import {Location} from 'history';

import {Client} from 'sentry/api';
import AsyncComponent from 'sentry/components/asyncComponent';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {Organization, PageFilters, SavedQuery} from 'sentry/types';
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
  homepageQuery?: SavedQuery;
  savedQuery?: SavedQuery;
};

type HomepageQueryState = AsyncComponent['state'] & {
  key: number;
  savedQuery?: SavedQuery | null;
};

class HomepageQueryAPI extends AsyncComponent<Props, HomepageQueryState> {
  shouldReload = true;

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, location} = this.props;

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
    // HACK: We're using state here to manage a component key so we can force remounting the entire discover result
    // This is because we need <Results> to rerun its constructor with the new homepage query to get it to display properly
    // We're checking to see that location.search is empty because that is the only time we should be fetching the homepage query
    if (location.search === '' && this.state) {
      this.setState({key: Date.now()});
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
        key={`results-${this.state.key}`}
      />
    );
  }
}

function HomepageContainer(props: Props) {
  return (
    <PageFiltersContainer
      skipLoadLastUsed={
        props.organization.features.includes('global-views') && !!props.savedQuery
      }
    >
      <HomepageQueryAPI {...props} />
    </PageFiltersContainer>
  );
}

export default withApi(withOrganization(withPageFilters(HomepageContainer)));
