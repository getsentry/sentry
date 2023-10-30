import FormField from 'sentry/components/forms/formField';
import {Slider, SliderProps} from 'sentry/components/slider';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import {InputFieldProps} from './inputField';

export interface RangeFieldProps
  extends Omit<SliderProps, 'value' | 'defaultValue' | 'disabled' | 'error'>,
    Omit<
      InputFieldProps,
      | 'disabled'
      | 'field'
      | 'step'
      | 'onChange'
      | 'max'
      | 'min'
      | 'onFocus'
      | 'onBlur'
      | 'css'
      | 'formatMessageValue'
    > {
  disabled?: boolean | ((props: Omit<RangeFieldProps, 'formatMessageValue'>) => boolean);
  disabledReason?: React.ReactNode;
  formatMessageValue?: false | Function;
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
      {({
        children: _children,
        onChange: fieldOnChange,
        label,
        onBlur,
        value,
        ...fieldProps
      }) => (
        <Slider
          {...fieldProps}
          aria-label={label}
          showThumbLabels
          value={value}
          onChangeEnd={val => onBlur(val, new MouseEvent(''))}
          onChange={val => fieldOnChange(val, new MouseEvent(''))}
        />
      )}
    </FormField>
  );
}

export default RangeField;
