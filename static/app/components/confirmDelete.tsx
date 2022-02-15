import * as React from 'react';

import Alert from 'sentry/components/alert';
import Confirm from 'sentry/components/confirm';
import Input from 'sentry/components/forms/controls/input';
import Field from 'sentry/components/forms/field';
import {t} from 'sentry/locale';

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
