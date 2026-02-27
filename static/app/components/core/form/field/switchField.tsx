import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {Flex} from '@sentry/scraps/layout';
import {Switch, type SwitchProps} from '@sentry/scraps/switch';

import {BaseField, type BaseFieldProps} from './baseField';

export function SwitchField({
  onChange,
  disabled,
  ref,
  ...props
}: BaseFieldProps<HTMLInputElement> &
  Omit<SwitchProps, 'checked' | 'onChange' | 'onBlur' | 'disabled' | 'id'> & {
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean | string;
  }) {
  const autoSaveContext = useAutoSaveContext();

  return (
    <BaseField disabled={disabled} ref={ref}>
      {(fieldProps, {indicator}) => (
        <Flex gap="sm" align="center" justify="between" flexGrow={1}>
          <Switch
            size="lg"
            {...fieldProps}
            {...props}
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
      )}
    </BaseField>
  );
}
