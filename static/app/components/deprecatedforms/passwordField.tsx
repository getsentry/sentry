import {useCallback, useEffect, useState} from 'react';

import {
  type InputFieldProps,
  useInputField,
} from 'sentry/components/deprecatedforms/inputField';
import FormState from 'sentry/components/forms/state';

type Props = InputFieldProps & {
  formState?: (typeof FormState)[keyof typeof FormState];
  hasSavedValue?: boolean;
  prefix?: string;
};

/**
 * @deprecated Do not use this
 */
function PasswordField({prefix = '', hasSavedValue = false, formState, ...props}: Props) {
  // Track whether we're in edit mode
  const [editing, setEditing] = useState(false);

  // Get the input field functionality
  const field = useInputField({
    ...props,
    type: 'password',
  });

  // Close edit mode after successful save
  useEffect(() => {
    if (formState && formState === FormState.READY) {
      setEditing(false);
    }
  }, [formState]);

  // Handle canceling edit mode
  const cancelEdit = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      setEditing(false);
      field.setValue('');
    },
    [field]
  );

  // Handle starting edit mode
  const startEdit = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setEditing(true);
  }, []);

  // If there's no saved value, render the standard password field
  if (!hasSavedValue) {
    return field.renderInputField();
  }

  // If we're in edit mode, render the password field with a cancel button
  if (editing) {
    return (
      <div className="form-password editing">
        <div>{field.renderInputField()}</div>
        <div>
          <a onClick={cancelEdit}>Cancel</a>
        </div>
      </div>
    );
  }

  // Otherwise, render the masked password with an edit button
  return (
    <div className="form-password saved">
      <span>{prefix + new Array(21 - prefix.length).join('*')}</span>
      {!props.disabled && <a onClick={startEdit}>Edit</a>}
    </div>
  );
}

export default PasswordField;
