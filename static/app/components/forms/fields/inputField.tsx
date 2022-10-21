import FormField, {FormFieldProps} from 'sentry/components/forms/formField';
import Input, {InputProps} from 'sentry/components/input';

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
  ...rest
}: {
  onBlur: OnEvent;
  onChange: OnEvent;
  onKeyDown: OnEvent;
}) {
  return (
    <Input
      onBlur={e => onBlur(e.target.value, e)}
      onKeyDown={e => onKeyDown((e.target as any).value, e)}
      onChange={e => onChange(e.target.value, e)}
      {...rest}
    />
  );
}

/**
 * InputField should be thought of as a "base" field, and generally not used
 * within the Form itself.
 */
function InputField({field = defaultField, ...props}: InputFieldProps) {
  return (
    <FormField {...props}>
      {({children: _children, ...otherFieldProps}) => field(otherFieldProps)}
    </FormField>
  );
}

export default InputField;
