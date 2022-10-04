import {browserHistory, InjectedRouter} from 'react-router';
import {Location} from 'history';

import {Client} from 'sentry/api';
import AsyncComponent from 'sentry/components/asyncComponent';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
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
  savedQuery?: SavedQuery | null;
};

class HomepageQueryAPI extends AsyncComponent<Props, HomepageQueryState> {
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

  onRequestSuccess = ({stateKey, data}) => {
    const {location} = this.props;
    if (stateKey === 'savedQuery') {
      const normalizedDateTime = normalizeDateTimeParams({
        start: data.start,
        end: data.end,
        statsPeriod: data.range,
        utc: data.utc,
      });

      browserHistory.replace({
        pathname: location.pathname,
        query: {
          project: data.projects ?? [],
          environment: data.environment ?? [],
          ...normalizedDateTime,
          ...location.query,
        },
      });
    }
  };

  setSavedQuery = (newSavedQuery: SavedQuery) => {
    this.setState({savedQuery: newSavedQuery});
  };

  renderLoading() {
    return this.renderBody();
  }

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
      skipLoadLastUsed={
        props.organization.features.includes('global-views') && !!props.savedQuery
      }
    >
      <HomepageQueryAPI {...props} />
    </PageFiltersContainer>
  );
}

export default withApi(withOrganization(withPageFilters(HomepageContainer)));
