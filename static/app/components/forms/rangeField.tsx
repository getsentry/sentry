import * as React from 'react';

import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import InputField, {InputFieldProps, onEvent} from 'sentry/components/forms/inputField';

interface DefaultProps {
  formatMessageValue?: false | Function;
}

type DisabledFunction = (
  props: Omit<RangeFieldProps<{}>, 'formatMessageValue'>
) => boolean;
type PlaceholderFunction = (props: any) => React.ReactNode;

interface RangeFieldProps<P extends {}>
  extends DefaultProps,
    Omit<
      React.ComponentProps<typeof RangeSlider>,
      'value' | 'disabled' | 'placeholder' | 'css'
    >,
    Omit<
      InputFieldProps<P>,
      | 'disabled'
      | 'field'
      | 'step'
      | 'onChange'
      | 'max'
      | 'min'
      | 'onBlur'
      | 'css'
      | 'formatMessageValue'
    > {
  disabled?: boolean | DisabledFunction;
  placeholder?: string | PlaceholderFunction;
}

function onChange(
  fieldOnChange: onEvent,
  value: number | '',
  e: React.FormEvent<HTMLInputElement>
) {
  fieldOnChange(value, e);
}

function defaultFormatMessageValue(value, props: RangeFieldProps<{}>) {
  return (typeof props.formatLabel === 'function' && props.formatLabel(value)) || value;
}

export default function RangeField<P extends {}>({
  formatMessageValue = defaultFormatMessageValue,
  disabled,
  ...otherProps
}: RangeFieldProps<P>) {
  const resolvedDisabled =
    typeof disabled === 'function' ? disabled(otherProps) : disabled;

  const props = {
    ...otherProps,
    disabled: resolvedDisabled,
    formatMessageValue,
  };

  return (
    <InputField
      {...props}
      field={({onChange: fieldOnChange, onBlur, value, ...fieldProps}) => (
        <RangeSlider
          {...fieldProps}
          value={value}
          onBlur={onBlur}
          onChange={(val, event) => onChange(fieldOnChange, val, event)}
        />
      )}
    />
  );
}
