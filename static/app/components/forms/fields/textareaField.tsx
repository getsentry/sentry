import FormField from 'sentry/components/forms/formField';
import FormFieldControlState from 'sentry/components/forms/formField/controlState';
import FormModel from 'sentry/components/forms/model';
import {InputGroup, TextAreaProps} from 'sentry/components/inputGroup';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import {InputFieldProps} from './inputField';

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
      }) => {
        const {
          onKeyDown: _,
          children: _c,
          required: _r,
          ...rest
        } = fieldProps as Record<any, any>;
        return (
          <InputGroup>
            <InputGroup.TextArea
              monospace={monospace}
              rows={rows}
              autosize={autosize}
              name={name}
              // Do not forward required to `textarea` to avoid default browser behavior
              {...rest}
            />
            {!hideControlState && (
              <InputGroup.TrailingItems>
                <FormFieldControlState model={model} name={name} />
              </InputGroup.TrailingItems>
            )}
          </InputGroup>
        );
      }}
    </FormField>
  );
}

export default TextareaField;
