import {Component} from 'react';

import {openConfirmModal} from 'sentry/components/confirm';
import type {ControlProps} from 'sentry/components/core/select';
import {Select} from 'sentry/components/core/select';
import {SelectOption} from 'sentry/components/core/select/option';
import {Tooltip} from 'sentry/components/core/tooltip';
import type {
  OptionsType,
  OptionTypeBase,
  ValueType,
} from 'sentry/components/forms/controls/reactSelectWrapper';
import {components as SelectComponents} from 'sentry/components/forms/controls/reactSelectWrapper';
import FormField from 'sentry/components/forms/formField';
import FormFieldControlState from 'sentry/components/forms/formField/controlState';
import FormState from 'sentry/components/forms/state';
import {t} from 'sentry/locale';
import type {Choices, SelectValue} from 'sentry/types/core';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import type {InputFieldProps} from './inputField';

const NONE_SELECTED_LABEL = t('None selected');

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
    formatMessageValue: (value: any, props: any) =>
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

    // Prevent onBlur from firing when toggling options in a multi-select.
    // Instead,onBlur is handled once at the component level.
    if (!this.props.multiple) {
      onBlur?.(value, {});
    }
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
          isOptionDisabled,
          ...props
        }: any) => {
          const showTempNoneOption =
            !multiple && (props.value === undefined || props.value === null);

          return (
            <Tooltip title={disabledReason} disabled={!disabled}>
              <Select
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
                isOptionDisabled={(option: any) => {
                  // We need to notify react-select about the disabled options here as well; otherwise, they will remain clickable.
                  if (option.label === NONE_SELECTED_LABEL) {
                    return true;
                  }
                  return typeof isOptionDisabled === 'function'
                    ? isOptionDisabled(option)
                    : false;
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
                  control: (provided: any) => ({
                    ...provided,
                    height: 'auto',
                  }),
                  ...props.styles,
                }}
                onChange={(val: any) => {
                  try {
                    // Multi-select workaround: reset the "saved" indicator on change to prevent it
                    // from appearing before the save completes (handled onBlur).
                    if (multiple) {
                      model.setFieldState(name, FormState.READY, false);
                    }

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
                  } catch (e: any) {
                    // Swallow expected error to prevent bubbling up.
                    if (e.message === 'Invalid selection. Field cannot be empty.') {
                      return;
                    }
                    throw e;
                  }
                }}
                onBlur={() => {
                  // For multiple selects, trigger onBlur when the component actually loses focus
                  // (as opposed to on every selection which would close the menu)
                  if (multiple) {
                    onBlur?.(props.value, {});
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
