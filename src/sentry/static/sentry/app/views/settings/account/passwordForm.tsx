import React from 'react';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import Form from 'app/views/settings/components/forms/form';
import Button from 'app/components/button';
import ConfigStore from 'app/stores/configStore';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import {PanelAlert, PanelItem} from 'app/components/panels';
import accountPasswordFields from 'app/data/forms/accountPassword';

type OnSubmitSuccess = Parameters<NonNullable<Form['props']['onSubmitSuccess']>>;

function PasswordForm() {
  function handleSubmitSuccess(_change: OnSubmitSuccess[0], model: OnSubmitSuccess[1]) {
    // Reset form on success
    model.resetForm();
    addSuccessMessage('Password has been changed');
  }

  function handleSubmitError() {
    addErrorMessage('Error changing password');
  }

  const user = ConfigStore.get('user');

  return (
    <Form
      apiMethod="PUT"
      apiEndpoint="/users/me/password/"
      initialData={{}}
      onSubmitSuccess={handleSubmitSuccess}
      onSubmitError={handleSubmitError}
      hideFooter
    >
      <JsonForm
        forms={accountPasswordFields}
        additionalFieldProps={{user}}
        renderFooter={() => (
          <PanelItem justifyContent="flex-end">
            <Button type="submit" priority="primary">
              {t('Change password')}
            </Button>
          </PanelItem>
        )}
        renderHeader={() => (
          <PanelAlert type="info">
            {t('Changing your password will invalidate all logged in sessions.')}
          </PanelAlert>
        )}
      />
    </Form>
  );
}

export default PasswordForm;
