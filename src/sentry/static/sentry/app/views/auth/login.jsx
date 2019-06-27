import React from 'react';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import withApi from 'app/utils/withApi';

import AuthLoginForm from './loginForm';
import AuthSsoForm from './ssoForm';
import AuthRegisterForm from './registerForm';

class AuthLogin extends React.Component {
  static propTypes = {
    api: PropTypes.object,
  };

  state = {
    activeTab: 'login',
    canRegister: false,
    githubLoginLink: '',
    vstsLoginLink: '',
    warning: null,
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
      this.setState({
        serverHostname: response.serverHostname,
        githubLoginLink: response.github_login_link,
        vstsLoginLink: response.vsts_login_link,
        canRegister: response.canRegister,
        hasNewsletter: response.hasNewsletter,
        warning: response.warning,
      });
    } catch (e) {
      // Swallow as this isn't critical stuff.
    }
  }

  render() {
    const {
      activeTab,
      hasNewsletter,
      serverHostname,
      canRegister,
      githubLoginLink,
      vstsLoginLink,
    } = this.state;
    const {api} = this.props;
    return (
      <React.Fragment>
        <div className="auth-container p-t-1 border-bottom">
          <h3>{t('Sign in to continue')}</h3>
          <ul className="nav nav-tabs auth-toggle m-b-0">
            <li className={activeTab === 'login' ? 'active' : ''}>
              <a href="#login" onClick={e => this.handleSetTab('login', e)}>
                {t('Login')}
              </a>
            </li>
            {canRegister && (
              <li className={activeTab === 'register' ? 'active' : ''}>
                <a href="#register" onClick={e => this.handleSetTab('register', e)}>
                  {t('Register')}
                </a>
              </li>
            )}
            <li className={activeTab === 'sso' ? 'active' : ''}>
              <a href="#sso" onClick={e => this.handleSetTab('sso', e)}>
                {t('Single Sign-On')}
              </a>
            </li>
          </ul>
        </div>
        <div className="tab-content">
          {activeTab === 'login' && (
            <AuthLoginForm
              api={api}
              githubLoginLink={githubLoginLink}
              vstsLoginLink={vstsLoginLink}
            />
          )}
          {activeTab === 'sso' && <AuthSsoForm api={api} hostname={serverHostname} />}
          {activeTab === 'register' && (
            <AuthRegisterForm api={api} hasNewsletter={hasNewsletter} />
          )}
        </div>
      </React.Fragment>
    );
  }
}
export default withApi(AuthLogin);
