import {components as SelectComponents} from 'react-select/src/components';

import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {Flex} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';

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
  ...props
}: BaseFieldProps &
  Omit<React.ComponentProps<typeof Select>, 'value' | 'onChange' | 'onBlur'> & {
    onChange: (value: string) => void;
    value: string;
    disabled?: boolean;
  }) {
  const autoSaveContext = useAutoSaveContext();

  return (
    <BaseField>
      {(fieldProps, {indicator}) => (
        <Select
          {...fieldProps}
          {...props}
          disabled={props.disabled || autoSaveContext?.status === 'pending'}
          components={{
            ...props.components,
            Input: SelectInput,
            IndicatorsContainer: ({
              children,
            }: React.ComponentProps<typeof SelectComponents.IndicatorsContainer>) => (
              <Flex padding="sm" gap="sm" align="center">
                {indicator}
                {children}
              </Flex>
            ),
          }}
          onChange={(option: SelectValue<string>) => onChange(option?.value ?? '')}
        />
      )}
    </BaseField>
  );
}
