import React from 'react';

import {updateUser} from 'app/actionCreators/account';
import AsyncView from 'app/views/asyncView';
import AvatarChooser from 'app/components/avatarChooser';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import accountDetailsFields from 'app/data/forms/accountDetails';
import accountPreferencesFields from 'app/data/forms/accountPreferences';

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

        <AvatarChooser
          endpoint="/users/me/avatar/"
          model={user}
          onSave={this.handleSubmitSuccess}
          isUser
        />
      </div>
    );
  }
}

export default AccountDetails;
