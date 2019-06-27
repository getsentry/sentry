import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {authConfigShape, formFooterClass} from 'app/views/auth/login';
import {t} from 'app/locale';
import Button from 'app/components/button';
import ConfigStore from 'app/stores/configStore';
import Form from 'app/components/forms/form';
import Link from 'app/components/links/link';
import PasswordField from 'app/components/forms/passwordField';
import TextField from 'app/components/forms/textField';
import space from 'app/styles/space';

const LoginProviders = ({vstsLoginLink, githubLoginLink}) => (
  <ProviderWrapper>
    <ProviderHeading>External Account Login</ProviderHeading>
    {githubLoginLink && (
      <Button align="left" size="small" icon="icon-github" href={githubLoginLink}>
        {t('Sign in with GitHub')}
      </Button>
    )}
    {vstsLoginLink && (
      <Button align="left" size="small" icon="icon-vsts" href={vstsLoginLink}>
        {t('Sign in with Azure DevOps')}
      </Button>
    )}
  </ProviderWrapper>
);

LoginProviders.propTypes = {
  githubLoginLink: PropTypes.string,
  vstsLoginLink: PropTypes.string,
};

class AuthLoginForm extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    authConfig: authConfigShape,
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
    const {githubLoginLink, vstsLoginLink} = this.props.authConfig;

    const hasLoginProvider = githubLoginLink || vstsLoginLink;

    return (
      <FormWrapper hasLoginProvider={hasLoginProvider}>
        <Form
          submitLabel={t('Continue')}
          onSubmit={this.handleSubmit}
          footerClass={formFooterClass}
          errorMessage={errorMessage}
          extraButton={
            <LostPasswordLink to="/account/recover/">
              {t('Lost your password?')}
            </LostPasswordLink>
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
        {hasLoginProvider && <LoginProviders {...{vstsLoginLink, githubLoginLink}} />}
      </FormWrapper>
    );
  }
}

const FormWrapper = styled('div')`
  display: grid;
  grid-gap: 60px;
  grid-template-columns: ${p => (p.hasLoginProvider ? '1fr 0.8fr' : '1fr')};
`;

const ProviderHeading = styled('div')`
  margin: 0;
  font-size: 15px;
  font-weight: bold;
  line-height: 24px;
`;

const ProviderWrapper = styled('div')`
  position: relative;
  display: grid;
  grid-auto-rows: max-content;
  grid-gap: ${space(1.5)};

  &:before {
    position: absolute;
    display: block;
    content: '';
    top: 0;
    bottom: 0;
    left: -30px;
    border-left: 1px solid ${p => p.theme.borderLight};
  }
`;

const LostPasswordLink = styled(Link)`
  color: ${p => p.theme.gray2};

  &:hover {
    color: ${p => p.theme.gray5};
  }
`;

export default AuthLoginForm;
