import React from 'react';

import {t} from 'app/locale';
import Alert from 'app/components/alert';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';

export default class AdminEnvironment extends AsyncView {
  state = {
    testEmailError: null,
    testEmailSent: false,
  };

  getEndpoints() {
    return [['data', this.getEndpoint()]];
  }

  getEndpoint() {
    return '/internal/mail/';
  }

  sendTestEmail = async () => {
    this.setState({
      testEmailError: null,
      testEmailSent: false,
    });

    try {
      await this.api.requestPromise('/internal/mail/', {method: 'POST'});
      this.setState({testEmailSent: true});
    } catch (error) {
      this.setState({
        testEmailError: error.responseJSON
          ? error.responseJSON.error
          : t('Unable to send test email. Check your server logs'),
      });
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
            <pre className="vall">
              {mailHost}:{mailPort}
            </pre>
          </dd>

          <dt>{t('Username')}</dt>
          <dd>
            <pre className="val">{mailUsername ? mailHost : <em>{t('not set')}</em>}</pre>
          </dd>

          <dt>{t('Password')}</dt>
          <dd>
            <pre className="val">
              {mailPassword ? '********' : <em>{t('not set')}</em>}
            </pre>
          </dd>

          <dt>{t('TLS?')}</dt>
          <dd>
            <pre className="val">{mailUseTls ? t('Yes') : t('No')}</pre>
          </dd>

          <dt>{t('Mailing List Namespace')}</dt>
          <dd>
            <pre className="val">{mailListNamespace}</pre>
          </dd>
        </dl>

        <h3>{t('Test Settings')}</h3>

        {this.state.testEmailSent && (
          <Alert type="info">
            {t('A test email has been sent to %s.', testMailEmail)}
          </Alert>
        )}
        {this.state.testEmailError && (
          <Alert type="error">{this.state.testEmailError}</Alert>
        )}

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
