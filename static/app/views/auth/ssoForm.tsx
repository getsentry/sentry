import {useState} from 'react';
import {browserHistory} from 'react-router';

import {Alert} from 'sentry/components/alert';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import {t, tct} from 'sentry/locale';
import {AuthConfig} from 'sentry/types';

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
      {error && <Alert type="error">{error}</Alert>}
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

const SlugExample = ({hostname, slug}: SlugExampleProps) => (
  <code>
    {hostname}/<strong>{slug}</strong>
  </code>
);

export default SsoForm;
