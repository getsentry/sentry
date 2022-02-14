import * as React from 'react';

import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import InputField, {onEvent} from 'sentry/components/forms/inputField';

type DefaultProps = {
  formatMessageValue?: false | Function;
};

type DisabledFunction = (props: Omit<Props, 'formatMessageValue'>) => boolean;
type PlaceholderFunction = (props: any) => React.ReactNode;

type Props = DefaultProps &
  Omit<React.ComponentProps<typeof RangeSlider>, 'value' | 'disabled' | 'placeholder'> &
  Omit<InputField['props'], 'disabled' | 'field'> & {
    disabled?: boolean | DisabledFunction;
    placeholder?: string | PlaceholderFunction;
  };

function onChange(
  fieldOnChange: onEvent,
  value: number | '',
  e: React.FormEvent<HTMLInputElement>
) {
  fieldOnChange(value, e);
}

function defaultFormatMessageValue(value, props: Props) {
  return (typeof props.formatLabel === 'function' && props.formatLabel(value)) || value;
}

export default function RangeField({
  formatMessageValue = defaultFormatMessageValue,
  disabled,
  ...otherProps
}: Props) {
  const resolvedDisabled =
    typeof disabled === 'function' ? disabled(otherProps) : disabled;

  const props: InputField['props'] = {
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
