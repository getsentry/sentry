import {Fragment} from 'react';
import type {DistributedOmit} from 'type-fest';

import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {Flex} from '@sentry/scraps/layout';
import {Slider, type SliderProps} from '@sentry/scraps/slider';

import {BaseField, type BaseFieldProps} from './baseField';

export function RangeField({
  onChange,
  disabled,
  value,
  ref,
  ...props
}: BaseFieldProps<HTMLInputElement> &
  DistributedOmit<SliderProps, 'value' | 'onChange' | 'onBlur' | 'disabled' | 'id'> & {
    onChange: (value: number) => void;
    value: number;
    disabled?: boolean | string;
  }) {
  const autoSaveContext = useAutoSaveContext();

  return (
    <BaseField disabled={disabled} ref={ref}>
      {(fieldProps, {indicator}) => (
        <Fragment>
          <Slider
            {...fieldProps}
            {...props}
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
        </Fragment>
      )}
    </BaseField>
  );
}
