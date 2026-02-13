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
  Omit<SwitchProps, 'checked' | 'onChange' | 'onBlur' | 'disabled'> & {
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
              {...fieldProps}
              {...props}
              disabled={isDisabled}
              onChange={e => {
                onChange(e.target.checked);
                // Trigger onBlur for auto-saving when the switch is toggled
                if (autoSaveContext) {
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
