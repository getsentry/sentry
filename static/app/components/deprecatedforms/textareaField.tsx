import {useCallback} from 'react';

import {
  type FormFieldProps,
  useFormField,
} from 'sentry/components/deprecatedforms/formField';

type Props = FormFieldProps & {
  placeholder?: string;
};

/**
 * @deprecated Do not use this
 */
function TextareaField(props: Props) {
  const field = useFormField({
    ...props,
    getClassName: () => 'control-group',
  });

  // Create a custom onChange handler for textarea
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      field.setValue(e.target.value);
    },
    [field]
  );

  return field.renderField(({id, value, disabled, required}) => (
    <textarea
      id={id}
      className="form-control"
      value={value as string}
      disabled={disabled}
      required={required}
      placeholder={props.placeholder}
      onChange={handleChange}
    />
  ));
}

export default TextareaField;
