import {useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import SecretField from 'sentry/components/forms/fields/secretField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import Link from 'sentry/components/links/link';
import {IconGithub, IconGoogle, IconVsts} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import space from 'sentry/styles/space';
import {AuthConfig} from 'sentry/types';

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
        size="sm"
        icon={<IconGoogle size="xs" />}
        href={googleLoginLink}
      >
        {t('Sign in with Google')}
      </Button>
    )}
    {githubLoginLink && (
      <Button
        align="left"
        size="sm"
        icon={<IconGithub size="xs" />}
        href={githubLoginLink}
      >
        {t('Sign in with GitHub')}
      </Button>
    )}
    {vstsLoginLink && (
      <Button align="left" size="sm" icon={<IconVsts size="xs" />} href={vstsLoginLink}>
        {t('Sign in with Azure DevOps')}
      </Button>
    )}
  </ProviderWrapper>
);

type Props = {
  authConfig: AuthConfig;
};

function LoginForm({authConfig}: Props) {
  const [error, setError] = useState('');

  const {githubLoginLink, vstsLoginLink} = authConfig;
  const hasLoginProvider = !!(githubLoginLink || vstsLoginLink);

  return (
    <FormWrapper hasLoginProvider={hasLoginProvider}>
      <Form
        submitLabel={t('Continue')}
        apiEndpoint="/auth/login/"
        apiMethod="POST"
        onSubmitSuccess={response => {
          // TODO(epurkhiser): There is likely more that needs to happen to update
          // the application state after user login.

          ConfigStore.set('user', response.user);

          // TODO(epurkhiser): Reconfigure sentry SDK identity

          browserHistory.push({pathname: response.nextUri});
        }}
        onSubmitError={response => {
          // TODO(epurkhiser): Need much better error handling here

          setError(response.responseJSON.errors.__all__);
        }}
        footerStyle={{
          borderTop: 'none',
          alignItems: 'center',
          marginBottom: 0,
          padding: 0,
        }}
        extraButton={
          <LostPasswordLink to="/account/recover/">
            {t('Lost your password?')}
          </LostPasswordLink>
        }
      >
        {error && <Alert type="error">{error}</Alert>}
        <TextField
          name="username"
          placeholder={t('username or email')}
          label={t('Account')}
          stacked
          inline={false}
          hideControlState
          required
        />
        <SecretField
          name="password"
          placeholder={t('password')}
          label={t('Password')}
          stacked
          inline={false}
          hideControlState
          required
        />
      </Form>
      {hasLoginProvider && <LoginProviders {...{vstsLoginLink, githubLoginLink}} />}
    </FormWrapper>
  );
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
  font-size: ${p => p.theme.fontSizeMedium};

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

export default LoginForm;
