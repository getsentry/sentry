import React from 'react';

import SettingsPageHeader from '../components/settingsPageHeader';
import accountNotificationFields from '../../../data/forms/accountNotificationSettings';
import Form from '../components/forms/form';
import JsonForm from '../components/forms/jsonForm';

const AccountNotifications = React.createClass({
  render() {
    return (
      <div>
        <SettingsPageHeader label="Notifications" />
        <Form>
          <JsonForm location={this.props.location} forms={accountNotificationFields} />
        </Form>
      </div>
    );
  },
});

export default AccountNotifications;
