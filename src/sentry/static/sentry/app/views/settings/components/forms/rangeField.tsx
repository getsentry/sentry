import React from 'react';

import InputField, {onEvent} from 'app/views/settings/components/forms/inputField';
import RangeSlider from 'app/views/settings/components/forms/controls/rangeSlider';

type DefaultProps = {
  formatMessageValue?: false | Function;
};

type DisabledFunction = (props: Omit<Props, 'formatMessageValue'>) => boolean;
type PlaceholderFunction = (props: any) => React.ReactNode;

type Props = DefaultProps &
  Omit<RangeSlider['props'], 'value' | 'disabled' | 'placeholder'> &
  Omit<InputField['props'], 'field'> & {
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
  ...otherProps
}: Props) {
  if (typeof otherProps.disabled === 'function') {
    otherProps.disabled = otherProps.disabled(otherProps);
  }
  const props: Props = Object.assign(otherProps, {formatMessageValue});

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
