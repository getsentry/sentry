import {useId} from 'react';

import {Checkbox} from '@sentry/scraps/checkbox';
import {fieldComponent, type AnyFieldApi} from '@sentry/scraps/form/formHelpers';
import {
  useAutoSaveContext,
  getLabelId,
  GroupProvider,
  useGroupItemContext,
} from '@sentry/scraps/formPresentation';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {BaseFieldImpl, type BaseFieldProps} from './baseField';

interface CheckboxGroupProps extends BaseFieldProps<HTMLDivElement> {
  children: React.ReactNode;
  field: AnyFieldApi;
  onChange: (value: string[]) => void;
  value: string[];
}

function CheckboxGroupImpl({
  field,
  children,
  value,
  onChange,
  disabled,
  ref,
}: CheckboxGroupProps) {
  const labelId = getLabelId(field);
  const autoSaveContext = useAutoSaveContext();

  return (
    <BaseFieldImpl field={field} disabled={disabled} ref={ref}>
      {({disabled: isDisabled, name, ...baseProps}, {indicator}) => (
        <GroupProvider
          value={{
            'aria-describedby': baseProps['aria-describedby'],
            'aria-invalid': baseProps['aria-invalid'],
            disabled: isDisabled,
            name,
            isChecked: itemValue => value.includes(itemValue),
            onChange: (itemValue, checked) => {
              onChange(
                checked ? [...value, itemValue] : value.filter(item => item !== itemValue)
              );
              if (autoSaveContext) {
                autoSaveContext.resetOnErrorRef.current = true;
                field.handleBlur();
              }
            },
          }}
        >
          <Stack
            {...baseProps}
            role="group"
            aria-labelledby={labelId}
            aria-disabled={isDisabled}
            flexGrow={1}
            tabIndex={-1}
            onFocus={event => {
              // Form errors and hash links focus the group through BaseField.
              // Move that focus to the first available control in the group.
              if (event.target === event.currentTarget) {
                event.currentTarget
                  .querySelector<HTMLInputElement>('input[type="checkbox"]:enabled')
                  ?.focus();
              }
            }}
          >
            {children}
          </Stack>
          {indicator}
        </GroupProvider>
      )}
    </BaseFieldImpl>
  );
}

export function CheckboxGroupItem({
  children,
  value: itemValue,
  disabled,
}: {
  children: React.ReactNode;
  value: string;
  disabled?: boolean;
}) {
  const {
    checked,
    onChange,
    disabled: groupDisabled,
    ...fieldProps
  } = useGroupItemContext(itemValue);
  const id = useId();

  return (
    <Flex as="label" gap="sm" align="center">
      <Checkbox
        {...fieldProps}
        id={id}
        value={itemValue}
        checked={checked}
        disabled={groupDisabled || disabled}
        onChange={event => onChange(itemValue, event.target.checked)}
      />
      <Text>{children}</Text>
    </Flex>
  );
}

export const CheckboxGroup = fieldComponent.loose(CheckboxGroupImpl, 'field');
