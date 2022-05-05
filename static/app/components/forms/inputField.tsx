import Input, {InputProps} from 'sentry/components/forms/controls/input';
import FormField, {FormFieldProps} from 'sentry/components/forms/formField';

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

export type onEvent = (value, event?: React.FormEvent<HTMLInputElement>) => void;

function defaultField({
  onChange,
  onBlur,
  onKeyDown,
  ...rest
}: {
  onBlur: onEvent;
  onChange: onEvent;
  onKeyDown: onEvent;
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

function InputField(props: InputFieldProps) {
  return (
    <FormField className={props.className} {...props}>
      {formFieldProps => {
        const {children: _children, ...otherFieldProps} = formFieldProps;
        return props.field ? props.field(otherFieldProps) : defaultField(otherFieldProps);
      }}
    </FormField>
  );
}

export default InputField;
