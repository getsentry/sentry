import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';

import {t, tct} from 'app/locale';
import Form from 'app/components/forms/form';
import SentryTypes from 'app/sentryTypes';
import TextField from 'app/components/forms/textField';

const SlugExample = p => (
  <code>
    {p.hostname}/<strong>{p.slug}</strong>
  </code>
);

class SsoForm extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    authConfig: SentryTypes.AuthConfig,
  };

  state = {
    errorMessage: null,
  };

  handleSubmit = async (data, onSuccess, onError) => {
    const {api} = this.props;
    try {
      const response = await api.requestPromise('/auth/sso-locate/', {
        method: 'POST',
        data,
      });
      onSuccess(data);
      browserHistory.push({pathname: response.nextUri});
    } catch (e) {
      if (!e.responseJSON) {
        onError(e);
        return;
      }
      const message = e.responseJSON.detail;
      this.setState({errorMessage: message});
      onError(e);
    }
  };

  render() {
    const {serverHostname} = this.props.authConfig;
    const {errorMessage} = this.state;

    return (
      <Form
        className="form-stacked"
        submitLabel={t('Continue')}
        onSubmit={this.handleSubmit}
        footerClass="auth-footer"
        errorMessage={errorMessage}
      >
        <TextField
          name="organization"
          placeholder="acme"
          label={t('Organization ID')}
          required
          help={tct('Your ID is the slug after the hostname. e.g. [example] is [slug].', {
            slug: <strong>acme</strong>,
            example: <SlugExample slug="acme" hostname={serverHostname} />,
          })}
        />
      </Form>
    );
  }
}

export default SsoForm;
