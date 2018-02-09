import React from 'react';

import {
  addErrorMessage,
  addSuccessMessage,
} from '../../../actionCreators/settingsIndicator';
import {t} from '../../../locale';
import Form from '../components/forms/form';
import Button from '../../../components/buttons/button';
import ConfigStore from '../../../stores/configStore';
import JsonForm from '../components/forms/jsonForm';
import PanelItem from '../components/panelItem';
import accountPasswordFields from '../../../data/forms/accountPassword';

const ENDPOINT = '/users/me/password/';

class PasswordForm extends React.Component {
  handleSubmitSuccess = (change, model, id) => {
    // Reset form on success
    model.resetForm();
    addSuccessMessage('Password has been changed');
  };

  handleSubmitError = (resp, model, id) => {
    addErrorMessage('Error changing password');
  };

  render() {
    let user = ConfigStore.get('user');
    return (
      <Form
        apiMethod="PUT"
        apiEndpoint={ENDPOINT}
        initialData={{}}
        onSubmitSuccess={this.handleSubmitSuccess}
        onSubmitError={this.handleSubmitError}
        hideFooter
      >
        <JsonForm
          location={this.props.location}
          forms={accountPasswordFields}
          additionalFieldProps={{user}}
          renderFooter={({title, fields}) => (
            <PanelItem justify="flex-end">
              <Button type="submit" priority="primary">
                {t('Change password')}
              </Button>
            </PanelItem>
          )}
        />
      </Form>
    );
  }
}

export default PasswordForm;
