import {
  type InputFieldProps,
  useInputField,
} from 'sentry/components/deprecatedforms/inputField';

type Props = InputFieldProps & {
  spellCheck?: string;
};

/**
 * @deprecated Do not use this
 */
function TextField(props: Props) {
  const {spellCheck, ...rest} = props;

  const field = useInputField({
    ...rest,
    type: 'text',
  });

  return field.renderField(fieldProps => {
    return (
      <input
        id={fieldProps.id}
        name={fieldProps.name}
        value={fieldProps.value}
        onChange={fieldProps.onChange}
        disabled={fieldProps.disabled}
        required={fieldProps.required}
        type="text"
        className="form-control"
        spellCheck={spellCheck as any}
      />
    );
  });
}

export default TextField;
