import {useRef} from 'react';
import styled from '@emotion/styled';
import {useButton} from '@react-aria/button';
import {useLocale} from '@react-aria/i18n';
import type {AriaNumberFieldProps} from '@react-aria/numberfield';
import {useNumberField} from '@react-aria/numberfield';
import {mergeRefs} from '@react-aria/utils';
import {useNumberFieldState} from '@react-stately/numberfield';

import {Button} from 'sentry/components/core/button';
import type {InputStylesProps} from 'sentry/components/core/input';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface NumberInputProps
  extends InputStylesProps,
    AriaNumberFieldProps,
    Pick<
      React.InputHTMLAttributes<HTMLInputElement>,
      'name' | 'disabled' | 'readOnly' | 'required' | 'className'
    > {
  max?: number;
  min?: number;
  ref?: React.Ref<HTMLInputElement>;
}

export function NumberInput({
  ref,
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
}: NumberInputProps) {
  const localRef = useRef<HTMLInputElement>(null);

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
    useNumberField(ariaProps, state, localRef);

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
        ref={mergeRefs(localRef, ref)}
        placeholder={placeholder}
        size={size}
        nativeSize={nativeSize}
        monospace={monospace}
        className={className}
      />
      <InputGroup.TrailingItems>
        <StepWrap size={size}>
          <StepButton
            ref={incrementButtonRef}
            size="zero"
            borderless
            {...incrementProps}
            aria-label={incrementProps['aria-label'] ?? t('Increment')}
            icon={<StyledIconChevron direction="up" />}
          />
          <StepButton
            ref={decrementButtonRef}
            size="zero"
            borderless
            {...decrementProps}
            aria-label={decrementProps['aria-label'] ?? t('Decrement')}
            icon={<StyledIconChevron direction="down" />}
          />
        </StepWrap>
      </InputGroup.TrailingItems>
    </InputGroup>
  );
}

const StepWrap = styled('div')<{size?: NonNullable<NumberInputProps['size']>}>`
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
  min-height: 0;
  color: ${p => p.theme.tokens.content.secondary};
`;

const StyledIconChevron = styled(IconChevron)`
  width: 0.5rem;
  height: 0.5rem;
`;
