import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {useApiQuery, useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

type MailData = {
  mailFrom: string;
  mailHost: string;
  mailListNamespace: string;
  mailPassword: string;
  mailPort: string;
  mailUseSsl: string;
  mailUseTls: string;
  mailUsername: string;
  testMailEmail: string;
};

export default function AdminMail() {
  const api = useApi();
  const {data, isLoading} = useApiQuery<MailData>(['/internal/mail/'], {staleTime: 0});

  const {mutate: sendTestEmail} = useMutation({
    mutationFn: () => api.requestPromise('/internal/mail/', {method: 'POST'}),
    onSuccess: () => {
      addSuccessMessage(t('A test email has been sent to %s', testMailEmail));
    },
    onError: () => {
      addErrorMessage(t('Unable to send test email. Check your server logs'));
    },
  });

  if (isLoading || !data) {
    return null;
  }

  const {
    mailFrom,
    mailHost,
    mailPort,
    mailUsername,
    mailPassword,
    mailUseTls,
    mailUseSsl,
    mailListNamespace,
    testMailEmail,
  } = data;

  return (
    <div>
      <h3>{t('SMTP Settings')}</h3>

      <dl className="vars">
        <dt>{t('From Address')}</dt>
        <dd>
          <pre className="val">{mailFrom}</pre>
        </dd>

        <dt>{t('Host')}</dt>
        <dd>
          <pre className="val">
            {mailHost}:{mailPort}
          </pre>
        </dd>

        <dt>{t('Username')}</dt>
        <dd>
          <pre className="val">{mailUsername || <em>{t('not set')}</em>}</pre>
        </dd>

        <dt>{t('Password')}</dt>
        <dd>
          <pre className="val">{mailPassword ? '********' : <em>{t('not set')}</em>}</pre>
        </dd>

        <dt>{t('STARTTLS?')}</dt>
        <dd>
          <pre className="val">{mailUseTls ? t('Yes') : t('No')}</pre>
        </dd>

        <dt>{t('SSL?')}</dt>
        <dd>
          <pre className="val">{mailUseSsl ? t('Yes') : t('No')}</pre>
        </dd>

        <dt>{t('Mailing List Namespace')}</dt>
        <dd>
          <pre className="val">{mailListNamespace}</pre>
        </dd>
      </dl>

      <h3>{t('Test Settings')}</h3>

      <p>
        {t(
          "Send an email to your account's email address to confirm that everything is configured correctly."
        )}
      </p>

      <Button onClick={() => sendTestEmail()}>
        {t('Send a test email to %s', testMailEmail)}
      </Button>
    </div>
  );
}
