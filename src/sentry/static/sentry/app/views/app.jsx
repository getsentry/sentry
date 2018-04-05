/*global __webpack_public_path__ */
/*eslint no-native-reassign:0 */
import $ from 'jquery';
import {ThemeProvider} from 'emotion-theming';
import Cookies from 'js-cookie';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import keydown from 'react-keydown';
import idx from 'idx';

import {openCommandPalette} from '../actionCreators/modal';
import {t} from '../locale';
import AlertActions from '../actions/alertActions';
import Alerts from '../components/alerts';
import ApiMixin from '../mixins/apiMixin';
import AssistantHelper from '../components/assistant/helper';
import ConfigStore from '../stores/configStore';
import ErrorBoundary from '../components/errorBoundary';
import GlobalModal from '../components/globalModal';
import Indicators from '../components/indicators';
import InstallWizard from './installWizard';
import LoadingIndicator from '../components/loadingIndicator';
import OrganizationsLoader from '../components/organizations/organizationsLoader';
import OrganizationsStore from '../stores/organizationsStore';
import theme from '../utils/theme';

if (window.globalStaticUrl) __webpack_public_path__ = window.globalStaticUrl; // defined in layout.html

function getAlertTypeForProblem(problem) {
  switch (problem.severity) {
    case 'critical':
      return 'error';
    default:
      return 'warning';
  }
}

const App = createReactClass({
  displayName: 'App',

  childContextTypes: {
    location: PropTypes.object,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: false,
      error: false,
      needsUpgrade: ConfigStore.get('needsUpgrade'),
    };
  },

  getChildContext() {
    return {
      location: this.props.location,
    };
  },

  componentWillMount() {
    this.api.request('/organizations/', {
      query: {
        member: '1',
      },
      success: data => {
        OrganizationsStore.load(data);
        this.setState({
          loading: false,
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
      },
    });

    this.api.request('/internal/health/', {
      success: data => {
        if (data && data.problems) {
          data.problems.forEach(problem => {
            AlertActions.addAlert({
              id: problem.id,
              message: problem.message,
              type: getAlertTypeForProblem(problem),
              url: problem.url,
            });
          });
        }
      },
      error: () => {}, // TODO: do something?
    });

    ConfigStore.get('messages').forEach(msg => {
      AlertActions.addAlert({
        message: msg.message,
        type: msg.level,
      });
    });

    $(document).ajaxError(function(evt, jqXHR) {
      // TODO: Need better way of identifying anonymous pages
      //       that don't trigger redirect
      let pageAllowsAnon = /^\/share\//.test(window.location.pathname);

      // Ignore error unless it is a 401
      if (!jqXHR || jqXHR.status !== 401 || pageAllowsAnon) return;

      let code = idx(jqXHR, _ => _.responseJSON.detail.code);
      let extra = idx(jqXHR, _ => _.responseJSON.detail.extra);

      // 401s can also mean sudo is required or it's a request that is allowed to fail
      // Ignore if these are the cases
      if (code === 'sudo-required' || code === 'ignore') return;

      // If user must login via SSO, redirect to org login page
      if (code === 'sso-required') {
        window.location.assign(extra.loginUrl);
        return;
      }

      // Otherwise, user has become unauthenticated; reload URL, and let Django
      // redirect to login page
      Cookies.set('session_expired', 1);
      window.location.reload();
    });
  },

  componentWillUnmount() {
    OrganizationsStore.load([]);
  },

  @keydown('cmd+shift+p')
  openCommandPalette(e) {
    openCommandPalette();
    e.preventDefault();
    e.stopPropagation();
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
      <ThemeProvider theme={theme}>
        <OrganizationsLoader>
          <GlobalModal />
          <Alerts className="messages-container" />
          <Indicators className="indicators-container" />
          <ErrorBoundary>{this.props.children}</ErrorBoundary>
          {ConfigStore.get('features').has('assistant') && <AssistantHelper />}
        </OrganizationsLoader>
      </ThemeProvider>
    );
  },
});

export default App;
