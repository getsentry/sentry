import React from 'react';

import AsyncView from '../../asyncView';
import Form from '../components/forms/form';
import JsonForm from '../components/forms/jsonForm';
import SettingsPageHeader from '../components/settingsPageHeader';
import accountDetailsFields from '../../../data/forms/accountDetails';

const ENDPOINT = '/users/me/';

class AccountDetails extends AsyncView {
  getEndpoints() {
    return [['user', ENDPOINT]];
  }

  handleSubmitSuccess = (change, model, id) => {
    // special logic for linked password fields
    if (id === 'passwordVerify' || id === 'password') {
      model.setValue('password', '');
      model.setValue('passwordVerify', '');
    } else {
      model.setValue(id, '');
    }
  };

  handleSubmitError = (resp, model, id) => {
    // Backend only uses `password` field since we always have to send both when changing a password
    if (id === 'passwordVerify' && resp.responseJSON.password) {
      model.setError(id, resp.responseJSON.password[0]);
    }
  };

  renderBody() {
    let {user} = this.state;

    return (
      <div>
        <SettingsPageHeader title="Account Details" />

        <Form
          apiMethod="PUT"
          apiEndpoint={ENDPOINT}
          saveOnBlur
          initialData={user}
          onSubmitSuccess={this.handleSubmitSuccess}
          onSubmitError={this.handleSubmitError}
        >
          <JsonForm
            location={this.props.location}
            forms={accountDetailsFields}
            additionalFieldProps={{user}}
          />
        </Form>
      </div>
    );
  }
}

export default AccountDetails;
