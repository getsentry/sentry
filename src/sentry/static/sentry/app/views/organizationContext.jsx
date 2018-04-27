import DocumentTitle from 'react-document-title';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import moment from 'moment';

import {setActiveOrganization} from 'app/actionCreators/organizations';
import {t} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import BroadcastModal from 'app/components/broadcastModal';
import ConfigStore from 'app/stores/configStore';
import HookStore from 'app/stores/hookStore';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import ProjectActions from 'app/actions/projectActions';
import ProjectsStore from 'app/stores/projectsStore';
import SentryTypes from 'app/proptypes';
import TeamStore from 'app/stores/teamStore';

let ERROR_TYPES = {
  ORG_NOT_FOUND: 'ORG_NOT_FOUND',
};

const OrganizationContext = createReactClass({
  displayName: 'OrganizationContext',

  childContextTypes: {
    organization: SentryTypes.Organization,
  },

  mixins: [ApiMixin, Reflux.listenTo(ProjectActions.createSuccess, 'onProjectCreation')],

  getInitialState() {
    return {
      loading: true,
      error: false,
      errorType: null,
      organization: null,
      showBroadcast: false,
    };
  },

  getChildContext() {
    return {
      organization: this.state.organization,
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (
      nextProps.params.orgId !== this.props.params.orgId ||
      nextProps.location.state === 'refresh'
    ) {
      this.remountComponent();
    }
  },

  componentWillUnmount() {
    TeamStore.reset();
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  onProjectCreation(project) {
    // If a new project was created, we need to re-fetch the
    // org details endpoint, which will propagate re-rendering
    // for the entire component tree
    this.remountComponent();
  },

  fetchData() {
    this.api.request(this.getOrganizationDetailsEndpoint(), {
      success: data => {
        // Allow injection via getsentry et all
        let hooks = [];
        HookStore.get('organization:header').forEach(cb => {
          hooks.push(cb(data));
        });

        setActiveOrganization(data);

        TeamStore.loadInitialData(data.teams);
        ProjectsStore.loadInitialData(data.projects);

        this.setState({
          organization: data,
          loading: false,
          error: false,
          errorType: null,
          hooks,
          showBroadcast: this.shouldShowBroadcast(data),
        });
      },

      error: (_, textStatus, errorThrown) => {
        let errorType = null;
        switch (errorThrown) {
          case 'NOT FOUND':
            errorType = ERROR_TYPES.ORG_NOT_FOUND;
            break;
          default:
        }
        this.setState({
          loading: false,
          error: true,
          errorType,
        });
      },
    });
  },

  getOrganizationDetailsEndpoint() {
    return '/organizations/' + this.props.params.orgId + '/';
  },

  getTitle() {
    if (this.state.organization) return this.state.organization.name;
    return 'Sentry';
  },

  shouldShowBroadcast(data) {
    let user = ConfigStore.get('user');
    let options = user ? user.options : {};
    let seen = options.seenReleaseBroadcast;
    let tasks = data.onboardingTasks;
    // don't show broadcast they've seen it
    if (seen) {
      return false;
    }

    // also if they havn't sent their first event
    let sentFirstEvent = tasks.find(
      ({task, status}) => task == 2 && status == 'complete'
    );

    if (!sentFirstEvent) {
      return false;
    }

    // show it if they sent their first event more than 2 days ago
    return moment().diff(sentFirstEvent.dateCompleted, 'days') > 2;
  },

  closeBroadcast() {
    this.setState({showBroadcast: false});
  },

  render() {
    if (this.state.loading) {
      return (
        <LoadingIndicator triangle={true}>
          {t('Loading data for your organization.')}
        </LoadingIndicator>
      );
    } else if (this.state.error) {
      switch (this.state.errorType) {
        case ERROR_TYPES.ORG_NOT_FOUND:
          return (
            <div className="container">
              <div className="alert alert-block">
                {t('The organization you were looking for was not found.')}
              </div>
            </div>
          );
        default:
          return <LoadingError onRetry={this.remountComponent} />;
      }
    }

    return (
      <DocumentTitle title={this.getTitle()}>
        <div className="app">
          {this.state.hooks}
          {this.state.showBroadcast && (
            <BroadcastModal closeBroadcast={this.closeBroadcast} />
          )}
          {this.props.children}
        </div>
      </DocumentTitle>
    );
  },
});

export default OrganizationContext;
