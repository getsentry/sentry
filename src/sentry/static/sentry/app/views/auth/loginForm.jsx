import React from 'react';
import PropTypes from 'prop-types';
import {browserHistory} from 'react-router';

import Form from 'app/components/forms/form';
import PasswordField from 'app/components/forms/passwordField';
import TextField from 'app/components/forms/textField';
import {t} from 'app/locale';

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
    const {api} = this.props;
    try {
      const response = await api.requestPromise('/auth/login/', {
        method: 'POST',
        data,
      });
      onSuccess(data);
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
