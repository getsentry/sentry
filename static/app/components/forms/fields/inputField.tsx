import FormField, {FormFieldProps} from 'sentry/components/forms/formField';
import FormFieldControlState from 'sentry/components/forms/formField/controlState';
import FormModel from 'sentry/components/forms/model';
import {InputGroup, InputProps} from 'sentry/components/inputGroup';

export interface InputFieldProps
  extends Omit<FormFieldProps, 'children'>,
    Omit<
      InputProps,
      | 'value'
      | 'placeholder'
      | 'disabled'
      | 'onBlur'
      | 'onKeyDown'
      | 'onChange'
      | 'children'
      | 'name'
      | 'defaultValue'
    > {
  // TODO(ts) Add base types for this. Each input field
  // has different props, but we could use have a base type that contains
  // the common properties.
  field?: (props) => React.ReactNode;
  value?: any;
}

export type OnEvent = (value, event?: React.FormEvent<HTMLInputElement>) => void;

function defaultField({
  onChange,
  onBlur,
  onKeyDown,
  model,
  name,
  hideControlState,
  ...rest
}: {
  model: FormModel;
  name: string;
  onBlur: OnEvent;
  onChange: OnEvent;
  onKeyDown: OnEvent;
  hideControlState?: boolean;
}) {
  return (
    <InputGroup>
      <InputGroup.Input
        onBlur={e => onBlur(e.target.value, e)}
        onKeyDown={e => onKeyDown((e.target as any).value, e)}
        onChange={e => onChange(e.target.value, e)}
        name={name}
        {...rest}
      />
      {!hideControlState && (
        <InputGroup.TrailingItems>
          <FormFieldControlState model={model} name={name} />
        </InputGroup.TrailingItems>
      )}
    </InputGroup>
  );
}

/**
 * InputField should be thought of as a "base" field, and generally not used
 * within the Form itself.
 */
function InputField({field = defaultField, hideControlState, ...props}: InputFieldProps) {
  return (
    <FormField {...props} hideControlState flexibleControlStateSize>
      {({children: _children, ...otherFieldProps}) =>
        field({...otherFieldProps, hideControlState})
      }
    </FormField>
  );
}

export default InputField;
