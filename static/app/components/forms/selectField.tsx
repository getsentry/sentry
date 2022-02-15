import * as React from 'react';
import {OptionsType, ValueType} from 'react-select';

import {openConfirmModal} from 'sentry/components/confirm';
import InputField from 'sentry/components/forms/inputField';
import SelectControl, {ControlProps} from 'sentry/components/forms/selectControl';
import {t} from 'sentry/locale';
import {Choices, SelectValue} from 'sentry/types';

type InputFieldProps = React.ComponentProps<typeof InputField>;

type Props<OptionType> = InputFieldProps &
  Omit<ControlProps<OptionType>, 'onChange'> & {
    /**
     * Should the select be clearable?
     */
    allowClear?: boolean;
    /**
     * Should the select allow empty values?
     */
    allowEmpty?: boolean;
    /**
     * Allow specific options to be 'confirmed' with a confirmation message.
     *
     * The key is the value that should be confirmed, the value is the message
     * to display in the confirmation modal.
     *
     * XXX: This only works when using the new-style options format, and _only_
     * if the value object has a `value` attribute in the option. The types do
     * not correctly reflect this so be careful!
     */
    confirm?: Record<string, React.ReactNode>;
    /**
     * A label that is shown inside the select control.
     */
    inFieldLabel?: string;
    small?: boolean;
  };

function getChoices<T>(props: Props<T>): Choices {
  const choices = props.choices;
  if (typeof choices === 'function') {
    return choices(props);
  }
  if (choices === undefined) {
    return [];
  }

  return choices;
}

/**
 * Required to type guard for OptionsType<T> which is a readonly Array
 */
function isArray<T>(maybe: T | OptionsType<T>): maybe is OptionsType<T> {
  return Array.isArray(maybe);
}

export default class SelectField<
  OptionType extends SelectValue<any>
> extends React.Component<Props<OptionType>> {
  static defaultProps = {
    allowClear: false,
    allowEmpty: false,
    placeholder: '--',
    escapeMarkup: true,
    multiple: false,
    small: false,
    formatMessageValue: (value, props) =>
      (getChoices(props).find(choice => choice[0] === value) || [null, value])[1],
  };

  handleChange = (
    onBlur: InputFieldProps['onBlur'],
    onChange: InputFieldProps['onChange'],
    optionObj: ValueType<OptionType>
  ) => {
    let value: any = undefined;

    // If optionObj is empty, then it probably means that the field was "cleared"
    if (!optionObj) {
      value = optionObj;
    } else if (this.props.multiple && isArray(optionObj)) {
      // List of optionObjs
      value = optionObj.map(({value: val}) => val);
    } else if (!isArray(optionObj)) {
      value = optionObj.value;
    }

    onChange?.(value, {});
    onBlur?.(value, {});
  };

  render() {
    const {allowClear, confirm, multiple, small, ...otherProps} = this.props;
    return (
      <InputField
        {...otherProps}
        alignRight={small}
        field={({onChange, onBlur, required: _required, ...props}) => (
          <SelectControl
            {...props}
            clearable={allowClear}
            multiple={multiple}
            onChange={val => {
              if (!confirm) {
                this.handleChange(onBlur, onChange, val);
                return;
              }

              // Support 'confirming' selections. This only works with
              // `val` objects that use the new-style options format
              const previousValue = props.value?.toString();
              // `val` may be null if clearing the select for an optional field
              const newValue = val?.value?.toString();

              // Value not marked for confirmation, or hasn't changed
              if (!confirm[newValue] || previousValue === newValue) {
                this.handleChange(onBlur, onChange, val);
                return;
              }

              openConfirmModal({
                onConfirm: () => this.handleChange(onBlur, onChange, val),
                message: confirm[val?.value] ?? t('Continue with these changes?'),
              });
            }}
          />
        )}
      />
    );
  }
}
