import React from 'react';

import Alert from 'app/components/alert';
import Confirm from 'app/components/confirm';
import {t} from 'app/locale';
import Input from 'app/views/settings/components/forms/controls/input';
import Field from 'app/views/settings/components/forms/field';

type Props = Omit<React.ComponentProps<typeof Confirm>, 'renderConfirmMessage'> & {
  /**
   * The string that the user must enter to confirm the deletion
   */
  confirmInput: string;
};

const ConfirmDelete = ({message, confirmInput, ...props}: Props) => (
  <Confirm
    {...props}
    bypass={false}
    disableConfirmButton
    renderMessage={({disableConfirmButton}) => (
      <React.Fragment>
        <Alert type="error">{message}</Alert>
        <Field
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
        </Field>
      </React.Fragment>
    )}
  />
);

export default ConfirmDelete;
