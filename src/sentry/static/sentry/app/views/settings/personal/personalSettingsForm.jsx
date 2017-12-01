import React from 'react';

import personalSettingsFields from '../../../data/forms/personalNotificationSettings';
import Form from '../components/forms/form';
import JsonForm from '../components/forms/jsonForm';

const PersonalSettingsForm = React.createClass({
  render() {
    return (
      <Form>
        <JsonForm location={this.props.location} forms={personalSettingsFields} />
      </Form>
    );
  }
});

export default PersonalSettingsForm;
