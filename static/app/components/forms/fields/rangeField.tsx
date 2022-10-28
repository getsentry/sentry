import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import FormField from 'sentry/components/forms/formField';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import {InputFieldProps, OnEvent} from './inputField';

type DisabledFunction = (props: Omit<RangeFieldProps, 'formatMessageValue'>) => boolean;
type PlaceholderFunction = (props: any) => React.ReactNode;

export interface RangeFieldProps
  extends Omit<
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
  formatMessageValue?: false | Function;
  placeholder?: string | PlaceholderFunction;
}

function onChange(
  fieldOnChange: OnEvent,
  value: number | '',
  e: React.FormEvent<HTMLInputElement>
) {
  fieldOnChange(value, e);
}

function defaultFormatMessageValue(value: number | '', {formatLabel}: RangeFieldProps) {
  return formatLabel?.(value) ?? value;
}

function RangeField({
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
    <FormField {...props}>
      {({children: _children, onChange: fieldOnChange, onBlur, value, ...fieldProps}) => (
        <RangeSlider
          {...fieldProps}
          value={value}
          onBlur={onBlur}
          onChange={(val, event) => onChange(fieldOnChange, val, event)}
        />
      )}
    </FormField>
  );
}

export default RangeField;
