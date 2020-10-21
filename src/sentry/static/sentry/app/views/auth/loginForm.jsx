import {ClassNames} from '@emotion/core';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import {Component} from 'react';
import styled from '@emotion/styled';

import {formFooterClass} from 'app/views/auth/login';
import {t} from 'app/locale';
import Button from 'app/components/button';
import ConfigStore from 'app/stores/configStore';
import Form from 'app/components/forms/form';
import Link from 'app/components/links/link';
import PasswordField from 'app/components/forms/passwordField';
import {IconGithub, IconGoogle, IconVsts} from 'app/icons';
import SentryTypes from 'app/sentryTypes';
import TextField from 'app/components/forms/textField';
import space from 'app/styles/space';

// TODO(epurkhiser): The abstraction here would be much nicer if we just
// exposed a configuration object telling us what auth providers there are.
const LoginProviders = ({vstsLoginLink, githubLoginLink, googleLoginLink}) => (
  <ProviderWrapper>
    <ProviderHeading>{t('External Account Login')}</ProviderHeading>
    {googleLoginLink && (
      <Button
        align="left"
        size="small"
        icon={<IconGoogle size="xs" />}
        href={googleLoginLink}
      >
        {t('Sign in with Google')}
      </Button>
    )}
    {githubLoginLink && (
      <Button
        align="left"
        size="small"
        icon={<IconGithub size="xs" />}
        href={githubLoginLink}
      >
        {t('Sign in with GitHub')}
      </Button>
    )}
    {vstsLoginLink && (
      <Button
        align="left"
        size="small"
        icon={<IconVsts size="xs" />}
        href={vstsLoginLink}
      >
        {t('Sign in with Azure DevOps')}
      </Button>
    )}
  </ProviderWrapper>
);

LoginProviders.propTypes = {
  githubLoginLink: PropTypes.string,
  vstsLoginLink: PropTypes.string,
  googleLoginLink: PropTypes.string,
};

class LoginForm extends Component {
  static propTypes = {
    api: PropTypes.object,
    authConfig: SentryTypes.AuthConfig,
  };

  state = {
    errorMessage: null,
    errors: {},
  };

  handleSubmit = async (data, onSuccess, onError) => {
    try {
      const response = await this.props.api.requestPromise('/auth/login/', {
        method: 'POST',
        data,
      });
      onSuccess(data);

      // TODO(epurkhiser): There is likely more that needs to happen to update
      // the application state after user login.

      ConfigStore.set('user', response.user);

      // TODO(epurkhiser): Reconfigure sentry SDK identity

      browserHistory.push({pathname: response.nextUri});
    } catch (e) {
      if (!e.responseJSON || !e.responseJSON.errors) {
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
      <ClassNames>
        {({css}) => (
          <FormWrapper hasLoginProvider={hasLoginProvider}>
            <Form
              submitLabel={t('Continue')}
              onSubmit={this.handleSubmit}
              footerClass={css`
                ${formFooterClass}
              `}
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
        )}
      </ClassNames>
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
  color: ${p => p.theme.gray500};

  &:hover {
    color: ${p => p.theme.gray800};
  }
`;

export default LoginForm;
