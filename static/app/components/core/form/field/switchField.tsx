import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {Flex} from '@sentry/scraps/layout';
import {Switch, type SwitchProps} from '@sentry/scraps/switch';

import {
  BaseField,
  FieldStatus,
  useAutoSaveIndicator,
  type BaseFieldProps,
} from './baseField';

export function SwitchField({
  onChange,
  disabled,
  ...props
}: BaseFieldProps &
  Omit<SwitchProps, 'checked' | 'onChange' | 'onBlur' | 'disabled'> & {
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean | string;
  }) {
  const autoSaveContext = useAutoSaveContext();
  const indicator = useAutoSaveIndicator();
  const isDisabled = !!disabled || autoSaveContext?.status === 'pending';

  return (
    <BaseField>
      {fieldProps => (
        <Flex gap="sm" align="center" justify="between">
          <Switch
            size="lg"
            {...fieldProps}
            {...props}
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
          <FieldStatus disabled={disabled} />
        </Flex>
      )}
    </BaseField>
  );
}
