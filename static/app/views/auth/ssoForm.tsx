import {useState} from 'react';

import {Alert} from 'sentry/components/core/alert/alert';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import {t, tct} from 'sentry/locale';
import type {AuthConfig} from 'sentry/types/auth';
import {browserHistory} from 'sentry/utils/browserHistory';

type Props = {
  authConfig: AuthConfig;
};

function SsoForm({authConfig}: Props) {
  const [error, setError] = useState('');

  const {serverHostname} = authConfig;

  return (
    <Form
      apiMethod="POST"
      apiEndpoint="/auth/sso-locate/"
      onSubmitSuccess={response => {
        browserHistory.push({pathname: response.nextUri});
      }}
      onSubmitError={response => {
        setError(response.responseJSON.detail);
      }}
      submitLabel={t('Continue')}
      footerStyle={{
        borderTop: 'none',
        alignItems: 'center',
        marginBottom: 0,
        padding: 0,
      }}
    >
      {error && (
        <Alert.Container>
          <Alert type="error">{error}</Alert>
        </Alert.Container>
      )}
      <TextField
        name="organization"
        placeholder="acme"
        label={t('Organization ID')}
        required
        stacked
        inline={false}
        hideControlState
        help={tct('Your ID is the slug after the hostname. e.g. [example] is [slug].', {
          slug: <strong>acme</strong>,
          example: <SlugExample slug="acme" hostname={serverHostname} />,
        })}
      />
    </Form>
  );
}

type SlugExampleProps = {
  hostname: string;
  slug: string;
};

function SlugExample({hostname, slug}: SlugExampleProps) {
  return (
    <code>
      {hostname}/<strong>{slug}</strong>
    </code>
  );
}

export default SsoForm;
