import React from 'react';

import SettingsPageHeader from '../components/settingsPageHeader';
import personalNotificationFields from '../../../data/forms/personalNotificationSettings';
import Form from '../components/forms/form';
import JsonForm from '../components/forms/jsonForm';

const PersonalNotifications = React.createClass({
  render() {
    return (
      <div>
        <SettingsPageHeader label="Notifications" />
        <Form>
          <JsonForm location={this.props.location} forms={personalNotificationFields} />
        </Form>
      </div>
    );
  }
});

export default PersonalNotifications;
