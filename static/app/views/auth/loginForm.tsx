import {useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import SecretField from 'sentry/components/forms/fields/secretField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {AuthConfig} from 'sentry/types/auth';
import {browserHistory} from 'sentry/utils/browserHistory';
import {ExternalProviderOptions} from 'sentry/views/auth/externalProviderOptions';

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
      {hasLoginProvider && (
        <ExternalProviderOptions
          type="signin"
          gitHubLink={githubLoginLink}
          azureDevOpsLink={vstsLoginLink}
        />
      )}
    </FormWrapper>
  );
}

const FormWrapper = styled('div')<{hasLoginProvider: boolean}>`
  display: grid;
  gap: 60px;
  grid-template-columns: ${p => (p.hasLoginProvider ? '1fr 0.8fr' : '1fr')};
`;

const LostPasswordLink = styled(Link)`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

export default LoginForm;
