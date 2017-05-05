import React from 'react';
import ApiMixin from '../mixins/apiMixin';
import DocumentTitle from 'react-document-title';
import Footer from '../components/footer';
import Sidebar from '../components/sidebar';
import HookStore from '../stores/hookStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import BroadcastModal from '../components/broadcastModal';
import moment from 'moment';
import PropTypes from '../proptypes';
import TeamStore from '../stores/teamStore';
import ProjectStore from '../stores/projectStore';
import ConfigStore from '../stores/configStore';

import OrganizationState from '../mixins/organizationState';

import {t} from '../locale';

let ERROR_TYPES = {
  ORG_NOT_FOUND: 'ORG_NOT_FOUND'
};

function doProjectsNeedShortId(teams) {
  for (let i = 0; i < teams.length; i++) {
    for (let j = 0; j < teams[i].projects.length; j++) {
      if (!teams[i].projects[j].callSignReviewed) {
        return true;
      }
    }
  }
  return false;
}

function getRequiredAdminActions(org) {
  let rv = [];
  if (doProjectsNeedShortId(org.teams)) {
    rv.push('SET_SHORT_IDS');
  }
  return rv;
}

const OrganizationDetails = React.createClass({
  childContextTypes: {
    organization: PropTypes.Organization
  },

  mixins: [ApiMixin, OrganizationState],

  getInitialState() {
    return {
      loading: true,
      error: false,
      errorType: null,
      organization: null,
      showBroadcast: false
    };
  },

  getChildContext() {
    return {
      organization: this.state.organization
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

  fetchData() {
    this.api.request(this.getOrganizationDetailsEndpoint(), {
      success: data => {
        // Allow injection via getsentry et all
        let hooks = [];
        HookStore.get('organization:header').forEach(cb => {
          hooks.push(cb(data));
        });

        data.requiredAdminActions = getRequiredAdminActions(data);
        this.setState({
          organization: data,
          loading: false,
          error: false,
          errorType: null,
          hooks: hooks,
          showBroadcast: this.shouldShowBroadcast(data)
        });

        TeamStore.loadInitialData(data.teams);
        ProjectStore.loadInitialData(
          data.teams.reduce((out, team) => {
            return out.concat(team.projects);
          }, [])
        );
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
          errorType: errorType
        });
      }
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
          <Sidebar />
          {this.state.showBroadcast &&
            <BroadcastModal closeBroadcast={this.closeBroadcast} />}
          {this.props.children}
          <Footer />
        </div>
      </DocumentTitle>
    );
  }
});

export default OrganizationDetails;
