import type {Ref} from 'react';
import {mergeRefs} from '@react-aria/utils';

import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {Flex} from '@sentry/scraps/layout';
import {Switch, type SwitchProps} from '@sentry/scraps/switch';
import {Tooltip} from '@sentry/scraps/tooltip';

import {BaseField, useFieldStateIndicator, type BaseFieldProps} from './baseField';

export function SwitchField({
  onChange,
  disabled,
  ...props
}: BaseFieldProps &
  Omit<SwitchProps, 'checked' | 'onChange' | 'onBlur' | 'disabled' | 'id'> & {
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean | string;
  }) {
  const autoSaveContext = useAutoSaveContext();
  const indicator = useFieldStateIndicator();
  const isDisabled = !!disabled || autoSaveContext?.status === 'pending';
  const disabledReason = typeof disabled === 'string' ? disabled : undefined;

  return (
    <BaseField>
      {fieldProps => {
        const switchElement = (
          <Flex gap="sm" align="center" justify="between">
            <Switch
              size="lg"
              {...fieldProps}
              {...props}
              ref={mergeRefs(fieldProps.ref as Ref<HTMLInputElement>, props.ref)}
              disabled={isDisabled}
              onChange={e => {
                onChange(e.target.checked);
                // Trigger onBlur for auto-saving when the switch is toggled
                if (autoSaveContext) {
                  // Switches should reset to previous value on error
                  autoSaveContext.resetOnErrorRef.current = true;
                  fieldProps.onBlur();
                }
              }}
            />
            {indicator}
          </Flex>
        );

        if (disabledReason) {
          return <Tooltip title={disabledReason}>{switchElement}</Tooltip>;
        }

        return switchElement;
      }}
    </BaseField>
  );
}
