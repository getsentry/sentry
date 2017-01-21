import React from 'react';
import $ from 'jquery';
import Cookies from 'js-cookie';

import ApiMixin from '../mixins/apiMixin';
import Alerts from '../components/alerts';
import AlertActions from '../actions/alertActions';
import ConfigStore from '../stores/configStore';
import Indicators from '../components/indicators';
import InstallWizard from './installWizard';
import LoadingIndicator from '../components/loadingIndicator';
import OrganizationsLoader from '../components/organizations/organizationsLoader';
import OrganizationStore from '../stores/organizationStore';

import {t} from '../locale';

function getAlertTypeForProblem(problem) {
  switch (problem.severity) {
    case 'critical':
      return 'error';
    default:
      return 'warning';
  }
}

const App = React.createClass({
  childContextTypes: {
    location: React.PropTypes.object
  },

  mixins: [
    ApiMixin
  ],

  getInitialState() {
    return {
      loading: false,
      error: false,
      needsUpgrade: ConfigStore.get('needsUpgrade'),
    };
  },

  getChildContext() {
    return {
      location: this.props.location
    };
  },

  componentWillMount() {
    this.api.request('/organizations/', {
      query: {
        'member': '1'
      },
      success: (data) => {
        OrganizationStore.load(data);
        this.setState({
          loading: false,
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });

    this.api.request('/internal/health/', {
      success: (data) => {
        if (data && data.problems) {
          data.problems.forEach(problem => {
            AlertActions.addAlert({
              id: problem.id,
              message: problem.message,
              type: getAlertTypeForProblem(problem),
              url: problem.url
            });
          });
        }
      },
      error: () => {} // TODO: do something?
    });

    ConfigStore.get('messages').forEach((msg) => {
      AlertActions.addAlert({
        message: msg.message,
        type: msg.level
      });
    });

    $(document).ajaxError(function (evt, jqXHR) {
      // TODO: Need better way of identifying anonymous pages
      //       that don't trigger redirect
      let pageAllowsAnon = /^\/share\//.test(window.location.pathname);
      if (jqXHR && jqXHR.status === 401 && !pageAllowsAnon) {
        Cookies.set('session_expired', 1);
        // User has become unauthenticated; reload URL, and let Django
        // redirect to login page
        window.location.reload();
      }
    });
  },

  componentWillUnmount() {
    OrganizationStore.load([]);
  },

  onConfigured() {
    this.setState({needsUpgrade: false});
  },

  render() {
    let user = ConfigStore.get('user');
    let needsUpgrade = this.state.needsUpgrade;

    if (user && user.isSuperuser && needsUpgrade) {
      return (
        <div>
          <Indicators className="indicators-container" />
          <InstallWizard onConfigured={this.onConfigured} />
        </div>
      );
    }

    if (this.state.loading) {
      return (
        <LoadingIndicator triangle={true}>
          {t('Getting a list of all of your organizations.')}
        </LoadingIndicator>
      );
    }

    return (
      <OrganizationsLoader>
        <Alerts className="messages-container" />
        <Indicators className="indicators-container" />
        {this.props.children}
      </OrganizationsLoader>
    );
  }
});

export default App;
