import omit from 'lodash/omit';

import type {TextAreaProps} from 'sentry/components/core/input/inputGroup';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import FormField from 'sentry/components/forms/formField';
import FormFieldControlState from 'sentry/components/forms/formField/controlState';
import type FormModel from 'sentry/components/forms/model';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import type {InputFieldProps} from './inputField';

export interface TextareaFieldProps
  extends Omit<InputFieldProps, 'field'>,
    Pick<TextAreaProps, 'monospace' | 'autosize' | 'rows' | 'maxRows'> {}

function TextareaField({
  monospace,
  rows,
  autosize,
  hideControlState,
  ...props
}: TextareaFieldProps) {
  return (
    <FormField {...props} hideControlState flexibleControlStateSize>
      {({
        children: _children,
        model,
        name,
        ...fieldProps
      }: {
        children: React.ReactNode;
        model: FormModel;
        name: string;
      }) => (
        <InputGroup>
          <InputGroup.TextArea
            {...{monospace, rows, autosize, name}}
            // Do not forward required to `textarea` to avoid default browser behavior
            {...omit(fieldProps, ['onKeyDown', 'children', 'required'])}
          />
          {!hideControlState && (
            <InputGroup.TrailingItems>
              <FormFieldControlState model={model} name={name} />
            </InputGroup.TrailingItems>
          )}
        </InputGroup>
      )}
    </FormField>
  );
}

export default TextareaField;
