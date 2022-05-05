import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import InputField, {InputFieldProps, onEvent} from 'sentry/components/forms/inputField';

interface DefaultProps {
  formatMessageValue?: false | Function;
}

type DisabledFunction = (props: Omit<RangeFieldProps, 'formatMessageValue'>) => boolean;
type PlaceholderFunction = (props: any) => React.ReactNode;

export interface RangeFieldProps
  extends DefaultProps,
    Omit<
      React.ComponentProps<typeof RangeSlider>,
      'value' | 'disabled' | 'placeholder' | 'css'
    >,
    Omit<
      InputFieldProps,
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

function defaultFormatMessageValue(value, props: RangeFieldProps) {
  return (typeof props.formatLabel === 'function' && props.formatLabel(value)) || value;
}

export default function RangeField({
  formatMessageValue = defaultFormatMessageValue,
  disabled,
  ...otherProps
}: RangeFieldProps) {
  const resolvedDisabled =
    typeof disabled === 'function' ? disabled(otherProps) : disabled;

  const props: InputFieldProps = {
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
