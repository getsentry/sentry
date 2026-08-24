import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import type {AnyFieldApi} from '@sentry/scraps/form/formHelpers';
import {Flex} from '@sentry/scraps/layout';
import {Switch, type SwitchProps} from '@sentry/scraps/switch';

import {BaseFieldImpl, type BaseFieldProps} from './baseField';

export function SwitchField({
  field,
  onChange,
  disabled,
  ref,
  ...props
}: BaseFieldProps<HTMLInputElement> & {field: AnyFieldApi} & Omit<
    SwitchProps,
    'checked' | 'onChange' | 'onBlur' | 'disabled' | 'id'
  > & {
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean | string;
  }) {
  const autoSaveContext = useAutoSaveContext();

  return (
    <BaseFieldImpl field={field} disabled={disabled} ref={ref}>
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
          {indicator ?? (autoSaveContext ? <Flex width="14px" flexShrink={0} /> : null)}
        </Flex>
      )}
    </BaseFieldImpl>
  );
}
