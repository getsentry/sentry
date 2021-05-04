import {Component} from 'react';
import {browserHistory} from 'react-router';

import {Client} from 'app/api';
import Form from 'app/components/forms/form';
import TextField from 'app/components/forms/textField';
import {t, tct} from 'app/locale';
import {AuthConfig} from 'app/types';

type Props = {
  api: Client;
  authConfig: AuthConfig;
};

type State = {
  errorMessage: string | null;
};

class SsoForm extends Component<Props, State> {
  state: State = {
    errorMessage: null,
  };

  handleSubmit: Form['props']['onSubmit'] = async (data, onSuccess, onError) => {
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
