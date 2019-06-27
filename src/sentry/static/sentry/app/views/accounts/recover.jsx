import React from 'react';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import Form from 'app/components/forms/form';
import TextField from 'app/components/forms/textField';
import withApi from 'app/utils/withApi';

class AccountRecover extends React.Component {
  static propTypes = {
    api: PropTypes.object,
  };

  state = {
    complete: false,
    error: null,
  };

  handleSubmit = async (data, onSuccess, onError) => {
    const {api} = this.props;
    try {
      await api.requestPromise('/account/recover/', {
        method: 'POST',
        data,
      });
      this.setState({complete: true});
      onSuccess(data);
    } catch (e) {
      if (!e.responseJSON) {
        onError(e);
        return;
      }
      this.setState({
        errorMessage: e.responseJSON.detail,
        errors: e.responseJSON.errors,
      });
      onError(e);
    }
  };

  render() {
    const {complete, errors, errorMessage} = this.state;
    // TODO figure this out
    // const {email} = window.location.query;
    const email = undefined;

    if (complete) {
      return (
        <div className="auth-container p-y-2">
          <h3>{t('Recover Account')}</h3>
          <p>
            {t(
              'We have sent an email to the address registered with this account containing further instructions to reset your password.'
            )}
          </p>
        </div>
      );
    }

    return (
      <div className="auth-container p-y-2">
        <h3>{t('Recover Account')}</h3>
        <p>{t('We will send a confirmation email to this address:')}</p>
        <Form
          submitLabel={t('Send Email')}
          onSubmit={this.handleSubmit}
          errorMessage={errorMessage}
        >
          <TextField
            name="user"
            value={email}
            placeholder={t('username or email')}
            error={errors && errors.user}
            required
          />
        </Form>
      </div>
    );
  }
}
export default withApi(AccountRecover);
