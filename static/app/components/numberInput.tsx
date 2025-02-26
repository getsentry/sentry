import {forwardRef, useRef} from 'react';
import styled from '@emotion/styled';
import {useButton} from '@react-aria/button';
import {useLocale} from '@react-aria/i18n';
import type {AriaNumberFieldProps} from '@react-aria/numberfield';
import {useNumberField} from '@react-aria/numberfield';
import {useNumberFieldState} from '@react-stately/numberfield';

import {Button} from 'sentry/components/button';
import type {InputStylesProps} from 'sentry/components/core/input';
import {InputGroup} from 'sentry/components/inputGroup';
import {IconChevron} from 'sentry/icons/iconChevron';
import {space} from 'sentry/styles/space';
import mergeRefs from 'sentry/utils/mergeRefs';
import type {FormSize} from 'sentry/utils/theme';

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
function BaseNumberInput(
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
  }: NumberInputProps,
  forwardedRef: React.Ref<HTMLInputElement>
) {
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
      <InputGroup.Input
        {...inputProps}
        ref={mergeRefs([ref, forwardedRef])}
        placeholder={placeholder}
        size={size}
        nativeSize={nativeSize}
        monospace={monospace}
        className={className}
      />
      <InputGroup.TrailingItems>
        <StepWrap size={size}>
          <StepButton ref={incrementButtonRef} size="zero" borderless {...incrementProps}>
            <StyledIconChevron direction="up" />
          </StepButton>
          <StepButton ref={decrementButtonRef} size="zero" borderless {...decrementProps}>
            <StyledIconChevron direction="down" />
          </StepButton>
        </StepWrap>
      </InputGroup.TrailingItems>
    </InputGroup>
  );
}

const NumberInput = forwardRef(BaseNumberInput);

export default NumberInput;

const StepWrap = styled('div')<{size?: FormSize}>`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: ${space(1.5)};
  height: ${p => (p.size === 'xs' ? '1rem' : '1.25rem')};
`;

const StepButton = styled(Button)`
  display: flex;
  height: 50%;
  padding: 0 ${space(0.25)};
  color: ${p => p.theme.subText};
`;

const StyledIconChevron = styled(IconChevron)`
  width: 0.5rem;
  height: 0.5rem;
`;
