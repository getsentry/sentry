import type {Ref} from 'react';
import {mergeRefs} from '@react-aria/utils';
import type {DistributedOmit} from 'type-fest';

import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {Flex} from '@sentry/scraps/layout';
import {Slider, type SliderProps} from '@sentry/scraps/slider';

import {
  BaseField,
  FieldStatus,
  useAutoSaveIndicator,
  type BaseFieldProps,
} from './baseField';

export function RangeField({
  onChange,
  disabled,
  value,
  ...props
}: BaseFieldProps &
  DistributedOmit<SliderProps, 'value' | 'onChange' | 'onBlur' | 'disabled' | 'id'> & {
    onChange: (value: number) => void;
    value: number;
    disabled?: boolean | string;
  }) {
  const autoSaveContext = useAutoSaveContext();
  const indicator = useAutoSaveIndicator();
  const isDisabled = !!disabled || autoSaveContext?.status === 'pending';

  return (
    <BaseField>
      {fieldProps => (
        <Flex gap="sm" align="center">
          <Slider
            {...fieldProps}
            {...props}
            ref={mergeRefs(fieldProps.ref as Ref<HTMLInputElement>, props.ref)}
            disabled={isDisabled}
            value={value}
            onChange={onChange}
            onPointerUp={e => {
              props.onPointerUp?.(e);
              if (autoSaveContext) {
                fieldProps.onBlur();
              }
            }}
          />
          {indicator ?? <Flex width="14px" flexShrink={0} />}
          <FieldStatus disabled={disabled} />
        </Flex>
      )}
    </BaseField>
  );
}
