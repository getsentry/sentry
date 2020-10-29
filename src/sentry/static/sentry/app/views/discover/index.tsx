import React from 'react';
import {browserHistory, WithRouterProps} from 'react-router';
import DocumentTitle from 'react-document-title';

import {getUserTimezone, getUtcToLocalDateObject} from 'app/utils/dates';
import {t} from 'app/locale';
import {updateProjects, updateDateTime} from 'app/actionCreators/globalSelection';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import {GlobalSelection, Organization} from 'app/types';
import {getDiscoverLandingUrl} from 'app/utils/discover/urls';
import Redirect from 'app/utils/redirect';

import Discover from './discover';
import createQueryBuilder from './queryBuilder';
import {
  getQueryFromQueryString,
  fetchSavedQuery,
  parseSavedQuery,
  getView,
} from './utils';
import {DiscoverWrapper} from './styles';
import {SavedQuery} from './types';

type Props = {
  organization: Organization;
  selection: GlobalSelection;
  params: any;
  location: any;
} & Pick<WithRouterProps, 'router'>;

type State = {
  isLoading: boolean;
  savedQuery: SavedQuery | null;
  view: string;
};

class DiscoverContainer extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      isLoading: true,
      savedQuery: null,
      view: getView(props.params, props.location.query.view),
    };

    const {search} = props.location;
    const {organization} = props;
    const query = getQueryFromQueryString(search);

    if (query.hasOwnProperty('projects')) {
      // Update global store with projects from querystring
      updateProjects(query.projects);
    } else {
      // Update query with global projects
      query.projects = props.selection.projects;
    }

    if (['range', 'start', 'end'].some(key => query.hasOwnProperty(key))) {
      this.setGlobalSelectionDate(query);
    } else {
      // Update query with global datetime values
      query.start = props.selection.datetime.start;
      query.end = props.selection.datetime.end;
      query.range = props.selection.datetime.period;
      query.utc = props.selection.datetime.utc;
    }

    this.queryBuilder = createQueryBuilder(query, organization);
  }

  static getDerivedStateFromProps(nextProps: Props, currState): State {
    const nextState = {...currState};
    nextState.view = getView(nextProps.params, nextProps.location.query.view);

    if (!nextProps.params.savedQueryId) {
      nextState.savedQuery = null;
      return nextState;
    }

    return nextState;
  }

  componentDidMount() {
    document.body.classList.add('body-discover');

    const {savedQueryId} = this.props.params;

    if (savedQueryId) {
      this.loadTags()
        .then(() => this.fetchSavedQuery(savedQueryId))
        .then(this.setLoadedState);
    } else {
      this.loadTags().then(this.setLoadedState);
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const currProps = this.props;
    const currState = this.state;

    // Switching from Saved to New
    if (!currProps.params.savedQueryId && prevProps.params.savedQueryId) {
      const {datetime, projects} = prevProps.selection;
      const {start, end, period: range} = datetime;
      this.queryBuilder.reset({projects, range, start, end});

      // Reset to default 14d
      this.setGlobalSelectionDate(null);
      return;
    }

    // Switching from a Saved to another Saved
    if (currProps.params.savedQueryId !== prevProps.params.savedQueryId) {
      this.fetchSavedQuery(currProps.params.savedQueryId);
      return;
    }

    // If there are updates within the same SavedQuery
    if (currState.savedQuery !== prevState.savedQuery) {
      this.setGlobalSelectionDate(currState.savedQuery);
    }
  }

  componentWillUnmount() {
    this.queryBuilder.cancelRequests();
    document.body.classList.remove('body-discover');
  }

  private queryBuilder: any;

  loadTags = () => this.queryBuilder.load();

  setGlobalSelectionDate(query: ReturnType<typeof getQueryFromQueryString> | null) {
    if (query) {
      const timezone = getUserTimezone();

      // start/end will always be in UTC, however we need to coerce into
      // system time for date picker to be able to synced.
      updateDateTime({
        start: (query.start && getUtcToLocalDateObject(query.start)) || null,
        end: (query.end && getUtcToLocalDateObject(query.end)) || null,
        period: query.range || null,
        utc: query.utc || timezone === 'UTC',
      });
    } else {
      updateDateTime({
        start: null,
        end: null,
        period: null,
        utc: true,
      });
    }
  }

  setLoadedState = () => {
    this.setState({isLoading: false});
  };

  fetchSavedQuery = (savedQueryId: string) => {
    const {organization} = this.props;

    return fetchSavedQuery(organization, savedQueryId)
      .then((resp: any) => {
        if (this.queryBuilder) {
          this.queryBuilder.reset(parseSavedQuery(resp));
        } else {
          this.queryBuilder = createQueryBuilder(parseSavedQuery(resp), organization);
        }

        this.setState({isLoading: false, savedQuery: resp, view: 'saved'});
      })
      .catch(() => {
        browserHistory.push({
          pathname: `/organizations/${organization.slug}/discover/`,
          query: {view: 'saved'},
        });
        window.location.reload();
      });
  };

  updateSavedQuery = (savedQuery: SavedQuery) => {
    this.setState({savedQuery});
  };

  toggleEditMode = () => {
    const {organization} = this.props;
    const {savedQuery} = this.state;
    const isEditingSavedQuery = this.props.location.query.editing === 'true';

    const newQuery = {...this.props.location.query};
    if (!isEditingSavedQuery) {
      newQuery.editing = 'true';
    } else {
      delete newQuery.editing;
    }

    browserHistory.push({
      pathname: `/organizations/${organization.slug}/discover/saved/${savedQuery!.id}/`,
      query: newQuery,
    });
  };

  renderNoAccess = () => {
    const {router, organization} = this.props;

    if (
      organization.features.includes('discover-query') ||
      organization.features.includes('discover-basic')
    ) {
      return <Redirect router={router} to={getDiscoverLandingUrl(organization)} />;
    } else {
      return <Alert type="warning">{t("You don't have access to this feature")}</Alert>;
    }
  };

  render() {
    const {isLoading, savedQuery, view} = this.state;

    const {location, organization, params, selection} = this.props;

    return (
      <DocumentTitle title={`Discover - ${organization.slug} - Sentry`}>
        <Feature
          features={['organizations:discover']}
          hookName="feature-disabled:discover-page"
          organization={organization}
          renderDisabled={this.renderNoAccess}
        >
          <DiscoverWrapper>
            <Discover
              utc={selection.datetime.utc}
              isLoading={isLoading}
              organization={organization}
              queryBuilder={this.queryBuilder}
              location={location}
              params={params}
              savedQuery={savedQuery}
              isEditingSavedQuery={this.props.location.query.editing === 'true'}
              updateSavedQueryData={this.updateSavedQuery}
              view={view}
              toggleEditMode={this.toggleEditMode}
            />
          </DiscoverWrapper>
        </Feature>
      </DocumentTitle>
    );
  }
}

export default withGlobalSelection(withOrganization(DiscoverContainer));
export {DiscoverContainer};
