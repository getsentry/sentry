import {useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import RadioBooleanField from 'sentry/components/forms/fields/radioField';
import SecretField from 'sentry/components/forms/fields/secretField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {AuthConfig} from 'sentry/types/auth';
import {browserHistory} from 'sentry/utils/browserHistory';

type Props = {
  authConfig: AuthConfig;
};

function RegisterForm({authConfig}: Props) {
  const {hasNewsletter} = authConfig;

  const [error, setError] = useState('');

  return (
    <Form
      apiMethod="POST"
      apiEndpoint="/auth/register/"
      initialData={{subscribe: true}}
      submitLabel={t('Continue')}
      onSubmitSuccess={response => {
        ConfigStore.set('user', response.user);
        browserHistory.push({pathname: response.nextUri});
      }}
      onSubmitError={response => {
        setError(response.responseJSON.detail);
      }}
      extraButton={
        <PrivacyPolicyLink href="https://sentry.io/privacy/">
          {t('Privacy Policy')}
        </PrivacyPolicyLink>
      }
    >
      {error && (
        <Alert.Container>
          <Alert type="error">{error}</Alert>
        </Alert.Container>
      )}
      <TextField
        name="name"
        placeholder={t('Jane Bloggs')}
        label={t('Name')}
        stacked
        inline={false}
        required
      />
      <TextField
        name="username"
        placeholder={t('you@example.com')}
        label={t('Email')}
        stacked
        inline={false}
        required
      />
      <SecretField
        name="password"
        placeholder={t('something super secret')}
        label={t('Password')}
        stacked
        inline={false}
        required
      />
      {hasNewsletter && (
        <RadioBooleanField
          name="subscribe"
          choices={[
            ['true', t('Yes, I would like to receive updates via email')],
            ['flase', t("No, I'd prefer not to receive these updates")],
          ]}
          help={tct(
            `We'd love to keep you updated via email with product and feature
           announcements, promotions, educational materials, and events. Our
           updates focus on relevant information, and we'll never sell your data
           to third parties. See our [link] for more details.`,
            {
              link: <a href="https://sentry.io/privacy/">Privacy Policy</a>,
            }
          )}
          stacked
          inline={false}
        />
      )}
    </Form>
  );
}

const PrivacyPolicyLink = styled(ExternalLink)`
  color: ${p => p.theme.gray300};

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

export default RegisterForm;
