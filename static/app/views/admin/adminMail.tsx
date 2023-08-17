import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';

type Data = {
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

type State = DeprecatedAsyncView['state'] & {data: Data};

export default class AdminMail extends DeprecatedAsyncView<{}, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    return [['data', '/internal/mail/']];
  }

  sendTestEmail = async () => {
    const testMailEmail = this.state.data.testMailEmail;

    try {
      await this.api.requestPromise('/internal/mail/', {method: 'POST'});
      addSuccessMessage(t('A test email has been sent to %s', testMailEmail));
    } catch (error) {
      addErrorMessage(
        error.responseJSON
          ? error.responseJSON.error
          : t('Unable to send test email. Check your server logs')
      );
    }
  };

  renderBody() {
    const {data} = this.state;
    const {
      mailHost,
      mailPassword,
      mailUsername,
      mailPort,
      mailUseTls,
      mailUseSsl,
      mailFrom,
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
            <pre className="val">
              {mailPassword ? '********' : <em>{t('not set')}</em>}
            </pre>
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

        <Button onClick={this.sendTestEmail}>
          {t('Send a test email to %s', testMailEmail)}
        </Button>
      </div>
    );
  }
}
