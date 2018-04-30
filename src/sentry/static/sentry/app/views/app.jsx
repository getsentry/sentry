/*global __webpack_public_path__ */
/*eslint no-native-reassign:0 */
import $ from 'jquery';
import {ThemeProvider} from 'emotion-theming';
import Cookies from 'js-cookie';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import keydown from 'react-keydown';
import idx from 'idx';

import {openCommandPalette} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import AlertActions from 'app/actions/alertActions';
import Alerts from 'app/components/alerts';
import ApiMixin from 'app/mixins/apiMixin';
import AssistantHelper from 'app/components/assistant/helper';
import ConfigStore from 'app/stores/configStore';
import ErrorBoundary from 'app/components/errorBoundary';
import GlobalModal from 'app/components/globalModal';
import Indicators from 'app/components/indicators';
import InstallWizard from 'app/views/installWizard';
import LoadingIndicator from 'app/components/loadingIndicator';
import NewsletterConsent from 'app/views/newsletterConsent';
import OrganizationsStore from 'app/stores/organizationsStore';
import theme from 'app/utils/theme';

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

  mixins: [ApiMixin, Reflux.listenTo(ConfigStore, 'onConfigStoreChange')],

  getInitialState() {
    let user = ConfigStore.get('user');
    return {
      loading: false,
      error: false,
      needsUpgrade: user && user.isSuperuser && ConfigStore.get('needsUpgrade'),
      newsletterConsentPrompt: user && user.flags.newsletter_consent_prompt,
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

  onConfigStoreChange(config) {
    let newState = {};
    if (config.needsUpgrade !== undefined) newState.needsUpgrade = config.needsUpgrade;
    if (config.user !== undefined) newState.user = config.user;
    if (Object.keys(newState).length > 0) this.setState(newState);
  },

  @keydown('meta+shift+p', 'meta+k')
  openCommandPalette(e) {
    openCommandPalette();
    e.preventDefault();
    e.stopPropagation();
  },

  onConfigured() {
    this.setState({needsUpgrade: false});
  },

  onNewsletterConsent() {
    // this is somewhat hackish
    this.setState({
      newsletterConsentPrompt: false,
    });
  },

  renderBody() {
    let {needsUpgrade, newsletterConsentPrompt} = this.state;
    if (needsUpgrade) {
      return <InstallWizard onConfigured={this.onConfigured} />;
    }

    if (newsletterConsentPrompt) {
      return <NewsletterConsent onSubmitSuccess={this.onNewsletterConsent} />;
    }

    return this.props.children;
  },

  render() {
    if (this.state.loading) {
      return (
        <LoadingIndicator triangle={true}>
          {t('Getting a list of all of your organizations.')}
        </LoadingIndicator>
      );
    }

    return (
      <ThemeProvider theme={theme}>
        <div className="main-container" tabIndex="-1">
          <GlobalModal />
          <Alerts className="messages-container" />
          <Indicators className="indicators-container" />
          <ErrorBoundary>{this.renderBody()}</ErrorBoundary>
          {ConfigStore.get('features').has('assistant') && <AssistantHelper />}
        </div>
      </ThemeProvider>
    );
  },
});

export default App;
