import React from 'react';

import {updateUser} from '../../../actionCreators/account';
import AccountAvatar from '../account/avatar';
import AsyncView from '../../asyncView';
import Form from '../components/forms/form';
import JsonForm from '../components/forms/jsonForm';
import SettingsPageHeader from '../components/settingsPageHeader';
import accountDetailsFields from '../../../data/forms/accountDetails';
import accountPreferencesFields from '../../../data/forms/accountPreferences';

const ENDPOINT = '/users/me/';

class AccountDetails extends AsyncView {
  getEndpoints() {
    return [['user', ENDPOINT]];
  }

  handleSubmitSuccess = user => {
    updateUser(user);
    this.setState({user});
  };

  handleSubmitError = (resp, model, id) => {};

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

        <Form
          apiMethod="PUT"
          apiEndpoint={ENDPOINT}
          saveOnBlur
          allowUndo
          initialData={this.state.user.options}
        >
          <JsonForm location={this.props.location} forms={accountPreferencesFields} />
        </Form>

        <AccountAvatar onSave={this.handleSubmitSuccess} user={user} />
      </div>
    );
  }
}

export default AccountDetails;
