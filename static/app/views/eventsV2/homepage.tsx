import {InjectedRouter} from 'react-router';
import {Location} from 'history';

import {Client} from 'sentry/api';
import AsyncComponent from 'sentry/components/asyncComponent';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {Organization, PageFilters, SavedQuery} from 'sentry/types';
import {defined} from 'sentry/utils';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';

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

type SavedQueryState = AsyncComponent['state'] & {
  savedQuery?: SavedQuery | null;
};

class SavedQueryAPI extends AsyncComponent<Props, SavedQueryState> {
  componentDidUpdate(prevProps: Props, prevState: State) {
    const {location} = this.props;
    if (
      !defined(location.query?.id) &&
      prevProps.location.query?.id !== location.query?.id
    ) {
      this.setState({savedQuery: undefined});
    }
    super.componentDidUpdate(prevProps, prevState);
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, location} = this.props;

    const endpoints: ReturnType<AsyncComponent['getEndpoints']> = [];
    if (location.query.id) {
      endpoints.push([
        'savedQuery',
        `/organizations/${organization.slug}/discover/saved/${location.query.id}/`,
      ]);
      return endpoints;
    }

    if (
      organization.features.includes('discover-query-builder-as-landing-page') &&
      organization.features.includes('discover-query') &&
      isEmpty(location.query)
    ) {
      endpoints.push([
        'homepageQuery',
        `/organizations/${organization.slug}/discover/homepage/`,
      ]);
    }
    return endpoints;
  }

  setSavedQuery = (newSavedQuery: SavedQuery) => {
    this.setState({savedQuery: newSavedQuery});
  };

  renderLoading() {
    return this.renderBody();
  }

  renderBody(): React.ReactNode {
    const {homepageQuery, savedQuery, loading} = this.state;
    return (
      <Results
        {...this.props}
        savedQuery={savedQuery ?? undefined}
        loading={loading}
        setSavedQuery={this.setSavedQuery}
        homepageQuery={homepageQuery}
      />
    );
  }
}

function HomepageContainer(props: Props) {
  /**
   * Block `<Results>` from mounting until GSH is ready since there are API
   * requests being performed on mount.
   *
   * Also, we skip loading last used projects if you have multiple projects feature as
   * you no longer need to enforce a project if it is empty. We assume an empty project is
   * the desired behavior because saved queries can contain a project filter. The only
   * exception is if we are showing a prebuilt saved query in which case we want to
   * respect pinned filters.
   */

  return (
    <PageFiltersContainer
      skipLoadLastUsed={
        props.organization.features.includes('global-views') && !!props.savedQuery
      }
    >
      <SavedQueryAPI {...props} />
    </PageFiltersContainer>
  );
}

export default withApi(withOrganization(withPageFilters(ResultsContainer)));
