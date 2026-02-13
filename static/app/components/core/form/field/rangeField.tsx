import type {DistributedOmit} from 'type-fest';

import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {Flex} from '@sentry/scraps/layout';
import {Slider, type SliderProps} from '@sentry/scraps/slider';
import {Tooltip} from '@sentry/scraps/tooltip';

import {BaseField, useFieldStateIndicator, type BaseFieldProps} from './baseField';

export function RangeField({
  onChange,
  disabled,
  value,
  ...props
}: BaseFieldProps &
  DistributedOmit<SliderProps, 'value' | 'onChange' | 'onBlur' | 'disabled'> & {
    onChange: (value: number) => void;
    value: number;
    disabled?: boolean | string;
  }) {
  const autoSaveContext = useAutoSaveContext();
  const indicator = useFieldStateIndicator();
  const isDisabled = !!disabled || autoSaveContext?.status === 'pending';
  const disabledReason = typeof disabled === 'string' ? disabled : undefined;

  return (
    <BaseField>
      {fieldProps => {
        const slider = (
          <Flex gap="sm" align="center">
            <Slider
              {...fieldProps}
              {...props}
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
          </Flex>
        );

        if (disabledReason) {
          return <Tooltip title={disabledReason}>{slider}</Tooltip>;
        }

        return slider;
      }}
    </BaseField>
  );
}
