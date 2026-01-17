import Confirm from 'sentry/components/confirm';
import {Switch, type SwitchProps} from 'sentry/components/core/switch';
import {Tooltip} from 'sentry/components/core/tooltip';
import FormField from 'sentry/components/forms/formField';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import type {InputFieldProps, OnEvent} from './inputField';

export interface BooleanFieldProps extends InputFieldProps {
  confirm?: {
    false?: React.ReactNode;
    isDangerous?: boolean;
    true?: React.ReactNode;
  };
}

export default function BooleanField({confirm, ...fieldProps}: BooleanFieldProps) {
  return (
    <FormField {...fieldProps} resetOnError>
      {({
        children: _children,
        onChange,
        onBlur,
        value,
        disabled,
        disabledReason,
        ...props
      }: {
        disabled: boolean;
        disabledReason: boolean;
        onBlur: OnEvent;
        onChange: OnEvent;
        type: string;
        value: any;
        children?: React.ReactNode;
      }) => {
        const handleChange = (event: React.FormEvent<HTMLInputElement>) => {
          const newValue = !value;
          onChange(newValue, event);
          onBlur(newValue, event);
        };

        const {type: _, ...propsWithoutType} = props;
        const switchProps: SwitchProps = {
          ...propsWithoutType,
          size: 'lg',
          checked: Boolean(value),
          disabled,
        };

        if (confirm) {
          const confirmMessage = confirm[(!value).toString() as 'true' | 'false'];

          return (
            <Confirm
              renderMessage={() => confirmMessage}
              onConfirm={() => handleChange({} as React.FormEvent<HTMLInputElement>)}
              isDangerous={confirm.isDangerous}
            >
              {({open}) => (
                <Tooltip title={disabledReason} skipWrapper disabled={!disabled}>
                  <Switch
                    {...switchProps}
                    onChange={confirmMessage ? open : handleChange}
                  />
                </Tooltip>
              )}
            </Confirm>
          );
        }

        return (
          <Tooltip title={disabledReason} skipWrapper disabled={!disabled}>
            <Switch {...switchProps} onChange={handleChange} />
          </Tooltip>
        );
      }}
    </FormField>
  );
}
