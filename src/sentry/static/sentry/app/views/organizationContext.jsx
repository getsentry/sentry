import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import moment from 'moment';
import styled from 'react-emotion';

import {openSudo} from 'app/actionCreators/modal';
import {setActiveOrganization} from 'app/actionCreators/organizations';
import {t} from 'app/locale';
import Alert from 'app/components/alert';
import ApiMixin from 'app/mixins/apiMixin';
import BroadcastModal from 'app/components/broadcastModal';
import ConfigStore from 'app/stores/configStore';
import HookStore from 'app/stores/hookStore';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import ProjectActions from 'app/actions/projectActions';
import ProjectsStore from 'app/stores/projectsStore';
import SentryTypes from 'app/sentryTypes';
import Sidebar from 'app/components/sidebar';
import TeamStore from 'app/stores/teamStore';
import space from 'app/styles/space';

let ERROR_TYPES = {
  ORG_NOT_FOUND: 'ORG_NOT_FOUND',
};

const OrganizationContext = createReactClass({
  displayName: 'OrganizationContext',

  propTypes: {
    includeSidebar: PropTypes.bool,
  },

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

      error: (err, textStatus, errorThrown) => {
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

        // If user is superuser, open sudo window
        let user = ConfigStore.get('user');
        if (!user || !user.isSuperuser || err.status !== 403) {
          return;
        }
        openSudo({
          retryRequest: () => Promise.resolve(this.fetchData()),
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

  renderSidebar() {
    if (!this.props.includeSidebar) return null;

    return <Sidebar {...this.props} organization={this.state.organization} />;
  },

  renderError() {
    let errorComponent;

    switch (this.state.errorType) {
      case ERROR_TYPES.ORG_NOT_FOUND:
        errorComponent = (
          <Alert type="error">
            {t('The organization you were looking for was not found.')}
          </Alert>
        );
        break;
      default:
        errorComponent = <LoadingError onRetry={this.remountComponent} />;
    }

    return <ErrorWrapper>{errorComponent}</ErrorWrapper>;
  },

  render() {
    if (this.state.loading) {
      return (
        <LoadingIndicator triangle={true}>
          {t('Loading data for your organization.')}
        </LoadingIndicator>
      );
    } else if (this.state.error) {
      return (
        <React.Fragment>
          {this.renderSidebar()}
          {this.renderError()}
        </React.Fragment>
      );
    }

    return (
      <DocumentTitle title={this.getTitle()}>
        <div className="app">
          {this.state.hooks}
          {this.state.showBroadcast && (
            <BroadcastModal closeBroadcast={this.closeBroadcast} />
          )}
          {this.renderSidebar()}

          {this.props.children}
        </div>
      </DocumentTitle>
    );
  },
});

export default OrganizationContext;

const ErrorWrapper = styled('div')`
  padding: ${space(3)};
`;
