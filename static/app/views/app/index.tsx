import {Component, createRef, lazy, Suspense} from 'react';
import keydown from 'react-keydown';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import PropTypes from 'prop-types';

import {
  displayDeployPreviewAlert,
  displayExperimentalSpaAlert,
} from 'app/actionCreators/deployPreview';
import {fetchGuides} from 'app/actionCreators/guides';
import {openCommandPalette} from 'app/actionCreators/modal';
import AlertActions from 'app/actions/alertActions';
import {Client, initApiClientErrorHandling} from 'app/api';
import ErrorBoundary from 'app/components/errorBoundary';
import GlobalModal from 'app/components/globalModal';
import HookOrDefault from 'app/components/hookOrDefault';
import Indicators from 'app/components/indicators';
import LoadingIndicator from 'app/components/loadingIndicator';
import {DEPLOY_PREVIEW_CONFIG, EXPERIMENTAL_SPA} from 'app/constants';
import {t} from 'app/locale';
import ConfigStore from 'app/stores/configStore';
import HookStore from 'app/stores/hookStore';
import OrganizationsStore from 'app/stores/organizationsStore';
import OrganizationStore from 'app/stores/organizationStore';
import {Config, Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import withConfig from 'app/utils/withConfig';
import NewsletterConsent from 'app/views/newsletterConsent';

import SystemAlerts from './systemAlerts';

const GlobalNotifications = HookOrDefault({
  hookName: 'component:global-notifications',
  defaultComponent: () => null,
});

function getAlertTypeForProblem(problem) {
  switch (problem.severity) {
    case 'critical':
      return 'error';
    default:
      return 'warning';
  }
}

type Props = {
  api: Client;
  config: Config;
} & RouteComponentProps<{}, {}>;

type State = {
  loading: boolean;
  error: boolean;
  needsUpgrade: boolean;
  newsletterConsentPrompt: boolean;
  user?: Config['user'];
  organization?: Organization;
};

class App extends Component<Props, State> {
  static childContextTypes = {
    location: PropTypes.object,
  };

  state: State = {
    loading: false,
    error: false,
    needsUpgrade: ConfigStore.get('user')?.isSuperuser && ConfigStore.get('needsUpgrade'),
    newsletterConsentPrompt: ConfigStore.get('user')?.flags?.newsletter_consent_prompt,
  };

  getChildContext() {
    return {
      location: this.props.location,
    };
  }

  componentDidMount() {
    this.props.api.request('/organizations/', {
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

    this.props.api.request('/internal/health/', {
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
        neverExpire: true,
      });
    });

    if (DEPLOY_PREVIEW_CONFIG) {
      displayDeployPreviewAlert();
    } else if (EXPERIMENTAL_SPA) {
      displayExperimentalSpaAlert();
    }

    initApiClientErrorHandling();

    const user = ConfigStore.get('user');
    if (user) {
      HookStore.get('analytics:init-user').map(cb => cb(user));
    }

    fetchGuides();
  }

  componentDidUpdate(prevProps) {
    const {config} = this.props;
    if (!isEqual(config, prevProps.config)) {
      this.handleConfigStoreChange(config);
    }
  }

  componentWillUnmount() {
    OrganizationsStore.load([]);
    this.unlistener?.();
  }

  mainContainerRef = createRef<HTMLDivElement>();
  unlistener = OrganizationStore.listen(
    state => this.setState({organization: state.organization}),
    undefined
  );

  handleConfigStoreChange(config) {
    const newState = {} as State;
    if (config.needsUpgrade !== undefined) {
      newState.needsUpgrade = config.needsUpgrade;
    }

    if (config.user !== undefined) {
      newState.user = config.user;
    }

    if (Object.keys(newState).length > 0) {
      this.setState(newState);
    }
  }

  @keydown('meta+shift+p', 'meta+k', 'ctrl+shift+p', 'ctrl+k')
  openCommandPalette(e) {
    openCommandPalette();
    e.preventDefault();
    e.stopPropagation();
  }

  @keydown('meta+shift+l', 'ctrl+shift+l')
  toggleDarkMode() {
    ConfigStore.set('theme', ConfigStore.get('theme') === 'light' ? 'dark' : 'light');
  }

  onConfigured = () => this.setState({needsUpgrade: false});

  // this is somewhat hackish
  handleNewsletterConsent = () =>
    this.setState({
      newsletterConsentPrompt: false,
    });

  handleGlobalModalClose = () => {
    if (typeof this.mainContainerRef.current?.focus === 'function') {
      // Focus the main container to get hotkeys to keep working after modal closes
      this.mainContainerRef.current.focus();
    }
  };

  renderBody() {
    const {needsUpgrade, newsletterConsentPrompt} = this.state;

    if (needsUpgrade) {
      const InstallWizard = lazy(() => import('app/views/admin/installWizard'));

      return (
        <Suspense fallback={null}>
          <InstallWizard onConfigured={this.onConfigured} />;
        </Suspense>
      );
    }

    if (newsletterConsentPrompt) {
      return <NewsletterConsent onSubmitSuccess={this.handleNewsletterConsent} />;
    }

    return this.props.children;
  }

  render() {
    if (this.state.loading) {
      return (
        <LoadingIndicator triangle>
          {t('Getting a list of all of your organizations.')}
        </LoadingIndicator>
      );
    }

    return (
      <MainContainer tabIndex={-1} ref={this.mainContainerRef}>
        <GlobalModal onClose={this.handleGlobalModalClose} />
        <SystemAlerts className="messages-container" />
        <GlobalNotifications
          className="notifications-container messages-container"
          organization={this.state.organization}
        />
        <Indicators className="indicators-container" />
        <ErrorBoundary>{this.renderBody()}</ErrorBoundary>
      </MainContainer>
    );
  }
}

export default withApi(withConfig(App));

const MainContainer = styled('div')`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  outline: none;
  padding-top: ${p => (ConfigStore.get('demoMode') ? p.theme.demo.headerSize : 0)};
`;
