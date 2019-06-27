import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import ConfigStore from 'app/stores/configStore';
import Form from 'app/components/forms/form';
import PasswordField from 'app/components/forms/passwordField';
import TextField from 'app/components/forms/textField';

class AuthLoginForm extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    githubLoginLink: PropTypes.string,
    vstsLoginLink: PropTypes.string,
  };

  state = {
    errorMessage: null,
    errors: {},
  };

  handleSubmit = async (data, onSuccess, onError) => {
    const formData = new FormData();
    formData.append('op', 'login');
    formData.append('username', data.username);
    formData.append('password', data.password);
    formData.append(
      'csrfmiddlewaretoken',
      document.cookie.split(';').reduce((res, cookie) => {
        const [key, value] = cookie.split('=');
        res[key] = value;
        return res;
      }, {}).sc
    );
    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        redirect: 'manual',
        body: formData,
      });
      if (response.status === 302) {
        document.location = response.headers.get('Location');
      } else {
        const err = new Error('Login failed.');
        err.responseJSON = {
          detail: 'Invalid username or password.',
          errors: {},
        };
        throw err;
      }
      onSuccess(data);

      // TODO(epurkhiser): There is more we need to do to setup the user. but
      // definitely primarily we need to init our user.
      ConfigStore.set('user', response.user);

      browserHistory.push({pathname: response.nextUri});
    } catch (e) {
      if (!e.responseJSON) {
        onError(e);
        return;
      }
      let message = e.responseJSON.detail;
      if (e.responseJSON.errors.__all__) {
        message = e.responseJSON.errors.__all__;
      }
      this.setState({
        errorMessage: message,
        errors: e.responseJSON.errors || {},
      });
      onError(e);
    }
  };

  render() {
    const {errorMessage, errors} = this.state;
    const {githubLoginLink, vstsLoginLink} = this.props;
    const hasLoginProvider = githubLoginLink || vstsLoginLink;

    return (
      <div className="tab-pane active" id="login">
        <div className="auth-container">
          <div className="auth-form-column">
            <Form
              submitLabel={t('Continue')}
              onSubmit={this.handleSubmit}
              footerClass="auth-footer"
              errorMessage={errorMessage}
              extraButton={
                <a href="/account/recover/" className="secondary">
                  {t('Lost your password?')}
                </a>
              }
            >
              <TextField
                name="username"
                placeholder={t('username or email')}
                label={t('Account')}
                error={errors.username}
                required
              />
              <PasswordField
                name="password"
                placeholder={t('password')}
                label={t('Password')}
                error={errors.password}
                required
              />
            </Form>
          </div>
          {hasLoginProvider && (
            <div className="auth-provider-column">
              {githubLoginLink && (
                <p>
                  <a
                    className="btn btn-default btn-login-github"
                    href={githubLoginLink}
                    style={{display: 'block'}}
                  >
                    <span className="provider-logo github" />
                    {t('Sign in with GitHub')}
                  </a>
                </p>
              )}
              {vstsLoginLink && (
                <p>
                  <a
                    className="btn btn-default btn-login-vsts"
                    href={vstsLoginLink}
                    style={{display: 'block'}}
                  >
                    <span className="provider-logo vsts" />
                    {t('Sign in with Azure DevOps')}
                  </a>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}
export default AuthLoginForm;
