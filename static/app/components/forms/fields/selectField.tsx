import {Component} from 'react';

import type {ControlProps, SelectValue} from '@sentry/scraps/select';
import {Select} from '@sentry/scraps/select';
import {Tooltip} from '@sentry/scraps/tooltip';

import {openConfirmModal} from 'sentry/components/confirm';
import {FormField} from 'sentry/components/forms/formField';
import {FormFieldControlState} from 'sentry/components/forms/formField/controlState';
import {t} from 'sentry/locale';
import type {Choices} from 'sentry/types/core';
import {convertFromSelect2Choices} from 'sentry/utils/convertFromSelect2Choices';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import type {InputFieldProps} from './inputField';

const NONE_SELECTED_LABEL = t('None selected');

export interface SelectFieldProps<OptionType extends SelectValue<any>>
  extends
    Omit<InputFieldProps, 'value'>,
    Omit<
      ControlProps<OptionType>,
      | 'ref'
      | 'aria-invalid'
      | 'onChange'
      | 'options'
      | 'defaultValue'
      | 'disabled'
      | 'name'
      | 'onBlur'
      | 'onFocus'
      | 'onKeyDown'
      | 'placeholder'
      | 'tabIndex'
    > {
  /**
   * Should the select be clearable?
   */
  allowClear?: boolean;
  /**
   * Should the select allow empty values?
   */
  allowEmpty?: boolean;
  choices?: Choices | ((props: SelectFieldProps<OptionType>) => Choices);
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
  options?: ControlProps<OptionType>['options'];
}

function getChoices<T extends SelectValue<any>>(props: SelectFieldProps<T>): Choices {
  const choices = props.choices;
  if (typeof choices === 'function') {
    return choices(props as any);
  }
  if (choices === undefined) {
    return [];
  }

  return choices;
}

/**
 * Required to type guard for readonly T[] which is a readonly Array
 */
function isArray<T extends SelectValue<any>>(
  maybe: T | readonly T[]
): maybe is readonly T[] {
  return Array.isArray(maybe);
}

export class SelectField<OptionType extends SelectValue<any>> extends Component<
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
    optionObj: OptionType | readonly OptionType[] | null | undefined
  ) => {
    let value: any;

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
    const {allowClear, confirm, multiple, hideControlState, ...otherProps} = this.props;

    return (
      <FormField {...otherProps} hideControlState flexibleControlStateSize>
        {(fieldProps: any) => {
          const {
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
            choices,
            options,
            ...props
          } = fieldProps;
          return (
            <Tooltip title={disabledReason} disabled={!disabled}>
              <Select
                {...props}
                options={
                  options ??
                  convertFromSelect2Choices(
                    typeof choices === 'function' ? choices(fieldProps) : choices
                  ) ??
                  []
                }
                value={props.value}
                placeholder={placeholder}
                disabled={disabled}
                id={id}
                clearable={allowClear}
                multiple={multiple}
                emptyOptionLabel={NONE_SELECTED_LABEL}
                indicator={
                  !hideControlState && <FormFieldControlState model={model} name={name} />
                }
                styles={{
                  control: (provided: any) => ({
                    ...provided,
                    height: 'auto',
                  }),
                  ...props.styles,
                }}
                onChange={(val: any) => {
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
