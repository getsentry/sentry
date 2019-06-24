import React from 'react';
import PropTypes from 'prop-types';
import {browserHistory} from 'react-router';

import Form from 'app/components/forms/form';
import TextField from 'app/components/forms/textField';
import {t} from 'app/locale';

class AuthSsoForm extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    hostname: PropTypes.string,
  };

  state = {
    errorMessage: null,
  };

  handleSubmit = async (data, onSuccess, onError) => {
    const {api} = this.props;
    try {
      const response = await api.requestPromise('/auth/sso_locate/', {
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
    const {hostname} = this.props;
    const {errorMessage} = this.state;

    return (
      <div className="tab-pane active" id="sso">
        <div className="auth-container">
          <div className="auth-form-column">
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
                help={
                  <React.Fragment>
                    Your ID is the slug after the hostname. e.g.
                    <code>
                      {hostname}/<strong>acme</strong>/
                    </code>{' '}
                    is <code>acme</code>.
                  </React.Fragment>
                }
              />
            </Form>
          </div>
        </div>
      </div>
    );
  }
}

export default AuthSsoForm;
