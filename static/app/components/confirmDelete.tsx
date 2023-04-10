import {Fragment} from 'react';

import {Alert} from 'sentry/components/alert';
import Confirm from 'sentry/components/confirm';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import Input from 'sentry/components/input';
import {t} from 'sentry/locale';

interface Props
  extends Omit<React.ComponentProps<typeof Confirm>, 'renderConfirmMessage'> {
  /**
   * The string that the user must enter to confirm the deletion
   */
  confirmInput: string;
}

function ConfirmDelete({message, confirmInput, ...props}: Props) {
  return (
    <Confirm
      {...props}
      bypass={false}
      disableConfirmButton
      renderMessage={({disableConfirmButton}) => (
        <Fragment>
          <Alert type="error">{message}</Alert>
          <FieldGroup
            flexibleControlStateSize
            inline={false}
            label={t(
              'Please enter %s to confirm the deletion',
              <code>{confirmInput}</code>
            )}
          >
            <Input
              type="text"
              placeholder={confirmInput}
              onChange={e => disableConfirmButton(e.target.value !== confirmInput)}
            />
          </FieldGroup>
        </Fragment>
      )}
    />
  );
}

export default ConfirmDelete;
