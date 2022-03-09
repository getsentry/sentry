import * as React from 'react';
import styled from '@emotion/styled';

import {Client} from 'sentry/api';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NavTabs from 'sentry/components/navTabs';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {AuthConfig} from 'sentry/types';
import withApi from 'sentry/utils/withApi';

import LoginForm from './loginForm';
import RegisterForm from './registerForm';
import SsoForm from './ssoForm';

const FORM_COMPONENTS = {
  login: LoginForm,
  register: RegisterForm,
  sso: SsoForm,
} as const;

type ActiveTab = keyof typeof FORM_COMPONENTS;

type TabConfig = [key: ActiveTab, label: string, disabled?: boolean];

type Props = {
  api: Client;
};

type State = {
  activeTab: ActiveTab;
  authConfig: null | AuthConfig;
  error: null | boolean;
  loading: boolean;
};

class Login extends React.Component<Props, State> {
  state: State = {
    loading: true,
    error: null,
    activeTab: 'login',
    authConfig: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  handleSetTab = (activeTab: ActiveTab, event: React.MouseEvent) => {
    this.setState({activeTab});
    event.preventDefault();
  };

  fetchData = async () => {
    const {api} = this.props;
    try {
      const response = await api.requestPromise('/auth/config/');

      const {vsts_login_link, github_login_link, google_login_link, ...config} = response;
      const authConfig = {
        ...config,
        vstsLoginLink: vsts_login_link,
        githubLoginLink: github_login_link,
        googleLoginLink: google_login_link,
      };

      this.setState({authConfig});
    } catch (e) {
      this.setState({error: true});
    }

    this.setState({loading: false});
  };

  get hasAuthProviders() {
    if (this.state.authConfig === null) {
      return false;
    }

    const {githubLoginLink, googleLoginLink, vstsLoginLink} = this.state.authConfig;
    return !!(githubLoginLink || vstsLoginLink || googleLoginLink);
  }

  render() {
    const {api} = this.props;
    const {loading, error, activeTab, authConfig} = this.state;

    const FormComponent = FORM_COMPONENTS[activeTab];

    const tabs: TabConfig[] = [
      ['login', t('Login')],
      ['sso', t('Single Sign-On')],
      ['register', t('Register'), !authConfig?.canRegister],
    ];

    const renderTab = ([key, label, disabled]: TabConfig) =>
      !disabled && (
        <li key={key} className={activeTab === key ? 'active' : ''}>
          <a href="#" onClick={e => this.handleSetTab(key, e)}>
            {label}
          </a>
        </li>
      );

    return (
      <React.Fragment>
        <Header>
          <Heading>{t('Sign in to continue')}</Heading>
          <AuthNavTabs>{tabs.map(renderTab)}</AuthNavTabs>
        </Header>
        {loading && <LoadingIndicator />}
        {error && (
          <StyledLoadingError
            message={t('Unable to load authentication configuration')}
            onRetry={this.fetchData}
          />
        )}
        {!loading && authConfig !== null && !error && (
          <FormWrapper hasAuthProviders={this.hasAuthProviders}>
            <FormComponent {...{api, authConfig}} />
          </FormWrapper>
        )}
      </React.Fragment>
    );
  }
}

const StyledLoadingError = styled(LoadingError)`
  margin: ${space(2)};
`;

const Header = styled('div')`
  border-bottom: 1px solid ${p => p.theme.border};
  padding: 20px 40px 0;
`;

const Heading = styled('h3')`
  font-size: 24px;
  margin: 0 0 20px 0;
`;

const AuthNavTabs = styled(NavTabs)`
  margin: 0;
`;

const FormWrapper = styled('div')<{hasAuthProviders: boolean}>`
  padding: 35px;
  width: ${p => (p.hasAuthProviders ? '600px' : '490px')};
`;

const formFooterClass = `
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1)};
  align-items: center;
  justify-items: end;
  border-top: none;
  margin-bottom: 0;
  padding: 0;
`;

export {formFooterClass};

export default withApi(Login);
