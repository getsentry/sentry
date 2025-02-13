import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import type {FormProps} from 'sentry/components/forms/form';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PanelItem from 'sentry/components/panels/panelItem';
import accountPasswordFields from 'sentry/data/forms/accountPassword';
import {t} from 'sentry/locale';
import {useUser} from 'sentry/utils/useUser';

type OnSubmitSuccess = Parameters<NonNullable<FormProps['onSubmitSuccess']>>;

function PasswordForm() {
  const user = useUser();

  function handleSubmitSuccess(_change: OnSubmitSuccess[0], model: OnSubmitSuccess[1]) {
    // Reset form on success
    model.resetForm();
    addSuccessMessage('Password has been changed');
  }

  function handleSubmitError() {
    addErrorMessage('Error changing password');
  }

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
          <Actions>
            <Button type="submit" priority="primary">
              {t('Change password')}
            </Button>
          </Actions>
        )}
        renderHeader={() => (
          <PanelAlert margin={false} type="info">
            {t('Changing your password will invalidate all logged in sessions.')}
          </PanelAlert>
        )}
      />
    </Form>
  );
}

const Actions = styled(PanelItem)`
  justify-content: flex-end;
`;

export default PasswordForm;
