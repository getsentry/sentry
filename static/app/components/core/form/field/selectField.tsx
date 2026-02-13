import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {Flex} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Tooltip} from '@sentry/scraps/tooltip';

import {components} from 'sentry/components/forms/controls/reactSelectWrapper';
import type {SelectValue} from 'sentry/types/core';

import {BaseField, type BaseFieldProps} from './baseField';

function SelectInput({
  selectProps,
  ...props
}: React.ComponentProps<typeof components.Input> & {
  selectProps: {'aria-invalid': boolean};
}) {
  return <components.Input {...props} aria-invalid={selectProps['aria-invalid']} />;
}

export function SelectField({
  onChange,
  disabled,
  ...props
}: BaseFieldProps &
  Omit<
    React.ComponentProps<typeof Select>,
    'value' | 'onChange' | 'onBlur' | 'disabled'
  > & {
    onChange: (value: string) => void;
    value: string;
    disabled?: boolean | string;
  }) {
  const autoSaveContext = useAutoSaveContext();
  const isDisabled = !!disabled || autoSaveContext?.status === 'pending';
  const disabledReason = typeof disabled === 'string' ? disabled : undefined;

  return (
    <BaseField>
      {({id, ...fieldProps}, {indicator}) => {
        const select = (
          <Select
            {...fieldProps}
            {...props}
            inputId={id}
            disabled={isDisabled}
            components={{
              ...props.components,
              Input: SelectInput,
              IndicatorsContainer: ({
                children,
              }: React.ComponentProps<typeof components.IndicatorsContainer>) => (
                <Flex padding="sm" gap="sm" align="center">
                  {indicator}
                  {children}
                </Flex>
              ),
            }}
            onChange={(option: SelectValue<string>) => onChange(option?.value ?? '')}
          />
        );

        if (disabledReason) {
          return <Tooltip title={disabledReason}>{select}</Tooltip>;
        }

        return select;
      }}
    </BaseField>
  );
}
