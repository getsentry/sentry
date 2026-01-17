import {useCallback} from 'react';

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

function coerceValue(value: unknown): boolean {
  return !!value;
}

interface FieldChildrenProps {
  disabled: boolean;
  onBlur: OnEvent;
  onChange: OnEvent;
  type: string;
  value: unknown;
  children?: React.ReactNode;
  disabledReason?: React.ReactNode;
}

function BooleanFieldInner({
  children: _children,
  onChange,
  onBlur,
  value,
  disabled,
  disabledReason,
  confirm,
  ...props
}: FieldChildrenProps & {confirm?: BooleanFieldProps['confirm']}) {
  const handleChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      // We need to toggle current value because Switch is not an input
      const newValue = coerceValue(!value);
      onChange(newValue, e);
      onBlur(newValue, e);
    },
    [value, onChange, onBlur]
  );

  const {type: _type, ...propsWithoutType} = props;
  const switchProps: SwitchProps = {
    ...propsWithoutType,
    size: 'lg',
    checked: coerceValue(value),
    disabled,
    onChange: handleChange,
  };

  if (confirm) {
    const confirmKey = (!value).toString() as 'true' | 'false';
    const confirmMessage = confirm[confirmKey];

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
              onChange={e => {
                // If we have a `confirm` message for this direction
                // Then show confirm dialog, otherwise propagate change as normal
                if (confirmMessage) {
                  // Open confirm modal
                  open();
                  return;
                }

                handleChange(e);
              }}
            />
          </Tooltip>
        )}
      </Confirm>
    );
  }

  return (
    <Tooltip title={disabledReason} skipWrapper disabled={!disabled}>
      <Switch {...switchProps} />
    </Tooltip>
  );
}

export default function BooleanField({confirm, ...fieldProps}: BooleanFieldProps) {
  return (
    <FormField {...fieldProps} resetOnError>
      {(fieldChildrenProps: FieldChildrenProps) => (
        <BooleanFieldInner {...fieldChildrenProps} confirm={confirm} />
      )}
    </FormField>
  );
}
