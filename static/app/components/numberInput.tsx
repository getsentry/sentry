import {forwardRef, ForwardRefRenderFunction, useRef} from 'react';
import styled from '@emotion/styled';
import {useButton} from '@react-aria/button';
import {useLocale} from '@react-aria/i18n';
import {useNumberField} from '@react-aria/numberfield';
import {useNumberFieldState} from '@react-stately/numberfield';
import {AriaNumberFieldProps} from '@react-types/numberfield';

import Button from 'sentry/components/button';
import {InputStylesProps} from 'sentry/components/input';
import {Input, InputGroup, InputTrailingItems} from 'sentry/components/inputGroup';
import {IconChevron} from 'sentry/icons/iconChevron';
import space from 'sentry/styles/space';
import mergeRefs from 'sentry/utils/mergeRefs';
import {FormSize} from 'sentry/utils/theme';

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
  {
    disabled,
    readOnly,
    monospace,
    min,
    max,
    size,
    placeholder,
    nativeSize,
    className,
    ...props
  },
  forwardedRef
) => {
  const ref = useRef<HTMLInputElement>(null);

  const ariaProps = {
    isDisabled: disabled,
    isReadOnly: readOnly,
    minValue: min,
    maxValue: max,
    placeholder,
    ...props,
  };
  const {locale} = useLocale();
  const state = useNumberFieldState({locale, ...ariaProps});
  const {groupProps, inputProps, incrementButtonProps, decrementButtonProps} =
    useNumberField(ariaProps, state, ref);

  const incrementButtonRef = useRef<HTMLButtonElement>(null);
  const {buttonProps: incrementProps} = useButton(
    incrementButtonProps,
    incrementButtonRef
  );

  const decrementButtonRef = useRef<HTMLButtonElement>(null);
  const {buttonProps: decrementProps} = useButton(
    decrementButtonProps,
    decrementButtonRef
  );

  return (
    <InputGroup {...groupProps}>
      <Input
        {...inputProps}
        ref={mergeRefs([ref, forwardedRef])}
        placeholder={placeholder}
        size={size}
        nativeSize={nativeSize}
        monospace={monospace}
        className={className}
      />
      <InputTrailingItems>
        <StepWrap size={size}>
          <StepButton ref={incrementButtonRef} size="zero" borderless {...incrementProps}>
            <StyledIconChevron direction="up" />
          </StepButton>
          <StepButton ref={decrementButtonRef} size="zero" borderless {...decrementProps}>
            <StyledIconChevron direction="down" />
          </StepButton>
        </StepWrap>
      </InputTrailingItems>
    </InputGroup>
  );
};

const NumberInput = forwardRef(BaseNumberInput);

export default NumberInput;

const StepWrap = styled('div')<{size?: FormSize}>`
  display: flex;
  flex-direction: column;
  height: ${p => p.theme.form[p.size ?? 'md'].height}px;
  width: ${space(1.5)};
  align-items: center;
`;

const StepButton = styled(Button)`
  display: flex;
  height: 50%;
  padding: 0 ${space(0.5)};
  color: ${p => p.theme.subText};
`;

const StyledIconChevron = styled(IconChevron)<{direction: 'up' | 'down'}>`
  width: 0.6em;
  height: 0.6em;

  ${p =>
    p.direction === 'up'
      ? `
    align-self: end;
  `
      : `align-self: start;`}
`;
