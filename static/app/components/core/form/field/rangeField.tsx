import {Fragment} from 'react';
import type {DistributedOmit} from 'type-fest';

import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import type {AnyFieldApi} from '@sentry/scraps/form/formHelpers';
import {Flex} from '@sentry/scraps/layout';
import {Slider, type SliderProps} from '@sentry/scraps/slider';

import {BaseFieldImpl, type BaseFieldProps} from './baseField';

export function RangeField({
  field,
  onChange,
  disabled,
  value,
  ref,
  ...props
}: BaseFieldProps<HTMLInputElement> & {field: AnyFieldApi} & DistributedOmit<
    SliderProps,
    'value' | 'onChange' | 'onBlur' | 'disabled' | 'id'
  > & {
    onChange: (value: number) => void;
    value: number;
    disabled?: boolean | string;
  }) {
  const autoSaveContext = useAutoSaveContext();

  return (
    <BaseFieldImpl field={field} disabled={disabled} ref={ref}>
      {(fieldProps, {indicator}) => (
        <Fragment>
          <Slider
            {...fieldProps}
            {...props}
            value={value}
            onChange={onChange}
            onChangeEnd={() => {
              if (autoSaveContext) {
                fieldProps.onBlur();
              }
            }}
          />
          {indicator ?? (autoSaveContext ? <Flex width="14px" flexShrink={0} /> : null)}
        </Fragment>
      )}
    </BaseFieldImpl>
  );
}
