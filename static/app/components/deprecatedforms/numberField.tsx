import {useCallback} from 'react';

import {
  type InputFieldProps,
  useInputField,
} from 'sentry/components/deprecatedforms/inputField';

type Props = InputFieldProps & {
  max?: number;
};

/**
 * @deprecated Do not use this
 */
function NumberField(props: Props) {
  const coerceValue = useCallback((value: any) => {
    // Handle empty string case explicitly
    if (value === '') {
      return null;
    }

    const intValue = parseInt(value, 10);

    // return null if new value is NaN
    if (isNaN(intValue)) {
      return null;
    }

    return intValue;
  }, []);

  const field = useInputField({
    ...props,
    type: 'number',
    coerceValue,
  });

  return field.renderInputField();
}

export default NumberField;
