import {Component} from 'react';
import type {OptionsType, OptionTypeBase, ValueType} from 'react-select';
import {components as SelectComponents} from 'react-select';

import {openConfirmModal} from 'sentry/components/confirm';
import type {ControlProps} from 'sentry/components/forms/controls/selectControl';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import SelectOption from 'sentry/components/forms/controls/selectOption';
import FormField from 'sentry/components/forms/formField';
import FormFieldControlState from 'sentry/components/forms/formField/controlState';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {Choices, SelectValue} from 'sentry/types/core';

const NONE_SELECTED_LABEL = t('None selected');

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import type {InputFieldProps} from './inputField';

export interface SelectFieldProps<OptionType extends OptionTypeBase>
  extends InputFieldProps,
    Omit<ControlProps<OptionType>, 'onChange'> {
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
}

function getChoices<T extends OptionTypeBase>(props: SelectFieldProps<T>): Choices {
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
function isArray<T extends OptionTypeBase>(
  maybe: T | OptionsType<T>
): maybe is OptionsType<T> {
  return Array.isArray(maybe);
}

export default class SelectField<OptionType extends SelectValue<any>> extends Component<
  SelectFieldProps<OptionType>
> {
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
    optionObj: ValueType<OptionType, boolean>
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
    const {allowClear, confirm, multiple, hideControlState, components, ...otherProps} =
      this.props;

    return (
      <FormField {...otherProps} hideControlState flexibleControlStateSize>
        {({
          id,
          onChange,
          onBlur,
          required: _required,
          children: _children,
          disabled,
          disabledReason,
          model,
          name,
          placeholder,
          ...props
        }) => {
          const showTempNoneOption =
            !multiple && (props.value === undefined || props.value === null);

          return (
            <Tooltip title={disabledReason} disabled={!disabled}>
              <SelectControl
                {...props}
                value={showTempNoneOption ? undefined : props.value}
                options={
                  showTempNoneOption && Array.isArray(props.options)
                    ? [{label: NONE_SELECTED_LABEL, value: props.value}, ...props.options]
                    : props.options
                }
                choices={
                  showTempNoneOption && Array.isArray(props.choices)
                    ? [[props.value, NONE_SELECTED_LABEL], ...props.choices]
                    : props.choices
                }
                placeholder={placeholder}
                disabled={disabled}
                inputId={id}
                clearable={allowClear}
                multiple={multiple}
                controlShouldRenderValue={!showTempNoneOption}
                isOptionDisabled={option => {
                  // We need to notify react-select about the disabled options here as well; otherwise, they will remain clickable.
                  return option.label === NONE_SELECTED_LABEL;
                }}
                components={{
                  IndicatorsContainer: ({
                    children,
                    ...indicatorsProps
                  }: React.ComponentProps<
                    typeof SelectComponents.IndicatorsContainer
                  >) => (
                    <SelectComponents.IndicatorsContainer {...indicatorsProps}>
                      {!hideControlState && (
                        <FormFieldControlState model={model} name={name} />
                      )}
                      {children}
                    </SelectComponents.IndicatorsContainer>
                  ),
                  Option: (
                    optionProps: React.ComponentProps<typeof SelectComponents.Option>
                  ) => {
                    if (optionProps.label === NONE_SELECTED_LABEL) {
                      // The isDisabled prop is passed here to ensure the options are styled accordingly.
                      return <SelectOption {...optionProps} isDisabled isSelected />;
                    }
                    return <SelectOption {...optionProps} />;
                  },
                  ...components,
                }}
                styles={{
                  control: provided => ({
                    ...provided,
                    height: 'auto',
                  }),
                  ...props.styles,
                }}
                onChange={val => {
                  try {
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
                  } catch (e) {
                    // Swallow expected error to prevent bubbling up.
                    if (e.message === 'Invalid selection. Field cannot be empty.') {
                      return;
                    }
                    throw e;
                  }
                }}
              />
            </Tooltip>
          );
        }}
      </FormField>
    );
  }
}
