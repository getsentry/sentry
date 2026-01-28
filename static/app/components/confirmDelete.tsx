import {Fragment, useId} from 'react';

import Confirm from 'sentry/components/confirm';
import {Alert} from 'sentry/components/core/alert';
import {InlineCode} from 'sentry/components/core/code';
import {Input} from 'sentry/components/core/input';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import {t} from 'sentry/locale';

interface Props
  extends Omit<React.ComponentProps<typeof Confirm>, 'renderConfirmMessage'> {
  /**
   * The string that the user must enter to confirm the deletion
   */
  confirmInput: string;
}

function ConfirmDelete({message, confirmInput, ...props}: Props) {
  const id = useId();

  return (
    <Confirm
      {...props}
      bypass={false}
      disableConfirmButton
      priority="danger"
      renderMessage={({disableConfirmButton, confirm: triggerConfirm}) => (
        <Fragment>
          <Alert.Container>
            <Alert variant="danger" showIcon={false}>
              {message}
            </Alert>
          </Alert.Container>
          <FieldGroup
            flexibleControlStateSize
            inline={false}
            stacked
            id={id}
            label={t(
              'Please enter %s to confirm the deletion',
              <InlineCode>{confirmInput}</InlineCode>
            )}
          >
            <Input
              type="text"
              id={id}
              name="confirm-text"
              placeholder={confirmInput}
              autoFocus
              onChange={e => disableConfirmButton(e.target.value !== confirmInput)}
              onKeyDown={({target, key}) =>
                target instanceof HTMLInputElement &&
                target.value === confirmInput &&
                key === 'Enter' &&
                triggerConfirm()
              }
            />
          </FieldGroup>
        </Fragment>
      )}
    />
  );
}

export default ConfirmDelete;
