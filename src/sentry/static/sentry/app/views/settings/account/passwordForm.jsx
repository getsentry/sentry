import React from 'react';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import Form from 'app/views/settings/components/forms/form';
import Button from 'app/components/buttons/button';
import ConfigStore from 'app/stores/configStore';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import {PanelItem} from 'app/components/panels';
import accountPasswordFields from 'app/data/forms/accountPassword';

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
