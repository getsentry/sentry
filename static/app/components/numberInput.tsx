import {forwardRef, ForwardRefRenderFunction, useRef} from 'react';
import {useLocale} from '@react-aria/i18n';
import {AriaNumberFieldProps, useNumberField} from '@react-aria/numberfield';
import {useNumberFieldState} from '@react-stately/numberfield';

import Input, {InputStylesProps} from 'sentry/components/input';
import mergeRefs from 'sentry/utils/mergeRefs';

export interface NumberInputProps
  extends InputStylesProps,
    AriaNumberFieldProps,
    Pick<
      React.InputHTMLAttributes<HTMLInputElement>,
      'name' | 'disabled' | 'readOnly' | 'required' | 'className'
    > {
  max?: number;
  min?: number;
}
const BaseNumberInput: ForwardRefRenderFunction<HTMLInputElement, NumberInputProps> = (
  {disabled, readOnly, monospace, min, max, size, nativeSize, className, ...props},
  forwardedRef
) => {
  const ref = useRef<HTMLInputElement>(null);

  const ariaProps = {
    isDisabled: disabled,
    isReadOnly: readOnly,
    minValue: min,
    maxValue: max,
    ...props,
  };
  const {locale} = useLocale();
  const state = useNumberFieldState({locale, ...ariaProps});
  const {inputProps} = useNumberField(ariaProps, state, ref);

  return (
    <Input
      {...inputProps}
      ref={mergeRefs([ref, forwardedRef])}
      type="number"
      size={size}
      nativeSize={nativeSize}
      monospace={monospace}
      className={className}
    />
  );
};

const NumberInput = forwardRef(BaseNumberInput);

export default NumberInput;
