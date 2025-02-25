import {useState} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {Alert} from 'sentry/components/core/alert/alert';
import SecretField from 'sentry/components/forms/fields/secretField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import Link from 'sentry/components/links/link';
import {IconGithub, IconGoogle, IconVsts} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {AuthConfig} from 'sentry/types/auth';
import {browserHistory} from 'sentry/utils/browserHistory';

type LoginProvidersProps = Partial<
  Pick<AuthConfig, 'vstsLoginLink' | 'githubLoginLink' | 'googleLoginLink'>
>;

// TODO(epurkhiser): The abstraction here would be much nicer if we just
// exposed a configuration object telling us what auth providers there are.
function LoginProviders({
  vstsLoginLink,
  githubLoginLink,
  googleLoginLink,
}: LoginProvidersProps) {
  return (
    <ProviderWrapper>
      <ProviderHeading>{t('External Account Login')}</ProviderHeading>
      {googleLoginLink && (
        <LinkButton size="sm" icon={<IconGoogle />} href={googleLoginLink}>
          {t('Sign in with Google')}
        </LinkButton>
      )}
      {githubLoginLink && (
        <LinkButton size="sm" icon={<IconGithub />} href={githubLoginLink}>
          {t('Sign in with GitHub')}
        </LinkButton>
      )}
      {vstsLoginLink && (
        <LinkButton size="sm" icon={<IconVsts />} href={vstsLoginLink}>
          {t('Sign in with Azure DevOps')}
        </LinkButton>
      )}
    </ProviderWrapper>
  );
}

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
        {error && (
          <Alert.Container>
            <Alert type="error">{error}</Alert>
          </Alert.Container>
        )}
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
  font-weight: ${p => p.theme.fontWeightBold};
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
