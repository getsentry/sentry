import React from 'react';
import PropTypes from 'prop-types';
import {browserHistory} from 'react-router';

import {t, tct} from 'app/locale';
import Form from 'app/components/forms/form';
import LoadingIndicator from 'app/components/loadingIndicator';
import PasswordField from 'app/components/forms/passwordField';
import withApi from 'app/utils/withApi';

class AccountRecoverConfirm extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    params: PropTypes.object,
  };

  state = {
    loading: true,
    readError: null,
    submitError: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  async fetchData() {
    const {api, params} = this.props;
    try {
      await api.requestPromise('/account/recover/confirm/', {
        method: 'GET',
        data: {hash: params.hash, user_id: params.userId, mode: 'recover'},
      });
      this.setState({loading: false});
    } catch (e) {
      this.setState({
        loading: false,
        readError: e.responseJSON.detail,
      });
    }
  }

  handleSubmit = async (data, onSuccess, onError) => {
    const {api, params} = this.props;
    try {
      const response = await api.requestPromise('/account/recover/confirm/', {
        method: 'POST',
        data: {hash: params.hash, user_id: params.userId, mode: 'recover', ...data},
      });
      onSuccess(data);
      browserHistory.push({pathname: response.nextUri});
    } catch (e) {
      if (!e.responseJSON) {
        onError(e);
        return;
      }
      this.setState({
        submitError: e.responseJSON.detail,
        errors: e.responseJSON.errors,
      });
      onError(e);
    }
  };

  render() {
    const {loading, readError, submitError} = this.state;
    if (loading) {
      return <LoadingIndicator />;
    }
    if (readError) {
      return (
        <div className="auth-container p-y-2">
          <h3>{t('Recover Account')}</h3>
          <p>
            {t(
              'We were unable to confirm your identity. Either the link you followed is invalid, or it has expired.'
            )}
            {tct('You can always [link].', {
              link: <a href="/account/recover">try again</a>,
            })}
          </p>
        </div>
      );
    }

    return (
      <div className="auth-container p-y-2">
        <h3>{t('Recover Account')}</h3>
        <p>
          {' '}
          {t(
            'You have confirmed your email, and may now update your password below.'
          )}{' '}
        </p>
        <Form
          submitLabel={t('Change Password')}
          onSubmit={this.handleSubmit}
          errorMessage={submitError}
        >
          <PasswordField name="password" placeholder={t('password')} required />
        </Form>
      </div>
    );
  }
}
export default withApi(AccountRecoverConfirm);
