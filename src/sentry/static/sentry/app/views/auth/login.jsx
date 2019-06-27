import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

import {t} from 'app/locale';
import NavTabs from 'app/components/navTabs';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';

import AuthLoginForm from './loginForm';
import AuthRegisterForm from './registerForm';
import AuthSsoForm from './ssoForm';

const FORM_COMPONENTS = {
  login: AuthLoginForm,
  register: AuthRegisterForm,
  sso: AuthSsoForm,
};

class AuthLogin extends React.Component {
  static propTypes = {
    api: PropTypes.object,
  };

  state = {
    activeTab: 'login',
    canRegister: false,
    authConfig: {},
  };

  componentDidMount() {
    this.fetchData();
  }

  handleSetTab = (activeTab, event) => {
    this.setState({activeTab});
    event.preventDefault();
  };

  async fetchData() {
    const {api} = this.props;
    try {
      const response = await api.requestPromise('/auth/login/');

      const {vsts_login_link, github_login_link, ...config} = response;
      const authConfig = {
        ...config,
        vstsLoginLink: vsts_login_link,
        githubLoginLink: github_login_link,
      };

      this.setState({canRegister: response.canRegister, authConfig});
    } catch (e) {
      // Swallow as this isn't critical stuff.
    }
  }

  get hasAuthProviders() {
    const {githubLoginLink, vstsLoginLink} = this.state.authConfig;
    return githubLoginLink || vstsLoginLink;
  }

  render() {
    const {api} = this.props;
    const {activeTab, canRegister, authConfig} = this.state;

    const FormComponent = FORM_COMPONENTS[activeTab];

    const tabs = [
      ['login', t('Login')],
      ['sso', t('Sigle Sign-On')],
      ['register', t('Register'), !canRegister],
    ];

    const navigation = (
      <AuthNavTabs>
        {tabs.map(([key, label]) => (
          <li key={key} className={activeTab === key && 'active'}>
            <a href="#" onClick={e => this.handleSetTab(key, e)}>
              {label}
            </a>
          </li>
        ))}
      </AuthNavTabs>
    );

    return (
      <React.Fragment>
        <Header>
          <Heading>{t('Sign in to continue')}</Heading>
          {navigation}
        </Header>
        <FormWrapper hasAuthProviders={this.hasAuthProviders}>
          <FormComponent {...{api, authConfig}} />
        </FormWrapper>
      </React.Fragment>
    );
  }
}

const Header = styled('div')`
  border-bottom: 1px solid ${p => p.theme.borderLight};
  padding: 20px 40px 0;
`;

const Heading = styled('h3')`
  font-size: 24px;
  margin: 0 0 20px 0;
`;

const AuthNavTabs = styled(NavTabs)`
  margin: 0;
`;

const FormWrapper = styled('div')`
  padding: 35px;
  width: ${p => (p.hasAuthProviders ? '600px' : '490px')};
`;

const formFooterClass = css`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1)};
  align-items: center;
  justify-items: end;
`;

const authConfigShape = PropTypes.shape({
  serverHostname: PropTypes.string,
  hasNewsletter: PropTypes.bool,
  githubLoginLink: PropTypes.string,
  vstsLoginLink: PropTypes.string,
});

export {formFooterClass, authConfigShape};

export default withApi(AuthLogin);
