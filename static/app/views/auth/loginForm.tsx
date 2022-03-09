import {Component} from 'react';
import {browserHistory} from 'react-router';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import Form from 'sentry/components/deprecatedforms/form';
import PasswordField from 'sentry/components/deprecatedforms/passwordField';
import TextField from 'sentry/components/deprecatedforms/textField';
import Link from 'sentry/components/links/link';
import {IconGithub, IconGoogle, IconVsts} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import space from 'sentry/styles/space';
import {AuthConfig} from 'sentry/types';
import {formFooterClass} from 'sentry/views/auth/login';

type LoginProvidersProps = Partial<
  Pick<AuthConfig, 'vstsLoginLink' | 'githubLoginLink' | 'googleLoginLink'>
>;

// TODO(epurkhiser): The abstraction here would be much nicer if we just
// exposed a configuration object telling us what auth providers there are.
const LoginProviders = ({
  vstsLoginLink,
  githubLoginLink,
  googleLoginLink,
}: LoginProvidersProps) => (
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

type Props = {
  api: Client;
  authConfig: AuthConfig;
};

type State = {
  errorMessage: null | string;
  errors: Record<string, string>;
};

class LoginForm extends Component<Props, State> {
  state: State = {
    errorMessage: null,
    errors: {},
  };

  handleSubmit: Form['props']['onSubmit'] = async (data, onSuccess, onError) => {
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

    const hasLoginProvider = !!(githubLoginLink || vstsLoginLink);

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

const FormWrapper = styled('div')<{hasLoginProvider: boolean}>`
  display: grid;
  gap: 60px;
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
  gap: ${space(1.5)};

  &:before {
    position: absolute;
    display: block;
    content: '';
    top: 0;
    bottom: 0;
    left: -30px;
    border-left: 1px solid ${p => p.theme.border};
  }
`;

const LostPasswordLink = styled(Link)`
  color: ${p => p.theme.gray300};

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

export default LoginForm;
