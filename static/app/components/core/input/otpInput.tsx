import {useState} from 'react';
import styled from '@emotion/styled';
import {
  OTPInput as OTPInputPrimitive,
  REGEXP_ONLY_DIGITS,
  REGEXP_ONLY_DIGITS_AND_CHARS,
} from 'input-otp';

import {Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {FormSize} from 'sentry/utils/theme';

import {inputStyles} from './inputStyles';

export interface OTPInputProps {
  length: number;
  onComplete: (value: string) => void;
  characterSet?: 'alphanumeric' | 'numeric';
  disabled?: boolean;
  size?: FormSize;
  transform?: (value: string) => string;
}

/** @public */
export function OTPInput({
  length,
  onComplete,
  characterSet = 'numeric',
  disabled = false,
  size = 'md',
  transform,
}: OTPInputProps) {
  const [value, setValue] = useState('');
  const transformValue = (newValue: string) => transform?.(newValue) ?? newValue;

  return (
    <OTPInputPrimitive
      aria-label={t('One-time password')}
      autoComplete="one-time-code"
      disabled={disabled}
      inputMode={characterSet === 'numeric' ? 'numeric' : 'text'}
      maxLength={length}
      onChange={newValue => setValue(transformValue(newValue))}
      onComplete={(newValue: string) => onComplete(transformValue(newValue))}
      pattern={
        characterSet === 'numeric' ? REGEXP_ONLY_DIGITS : REGEXP_ONLY_DIGITS_AND_CHARS
      }
      render={({slots}) => (
        <Flex aria-hidden gap="xs" paddingRight="md">
          {slots.map((slot, index) => (
            <OTPInputSlot
              key={index}
              align="center"
              aria-hidden
              aria-disabled={disabled}
              data-input-otp-slot
              justify="center"
              $isActive={slot.isActive}
              $size={size}
            >
              {slot.char ?? slot.placeholderChar}
            </OTPInputSlot>
          ))}
        </Flex>
      )}
      value={value}
    />
  );
}

const OTPInputSlot = styled(Flex)<{$isActive: boolean; $size: FormSize}>`
  ${p => inputStyles({theme: p.theme, size: p.$size})};
  display: flex;
  min-width: ${p => p.theme.form[p.$size].height};
  padding: 0;
  width: ${p => p.theme.form[p.$size].height};

  ${p =>
    p.$isActive &&
    p.theme.focusRing(
      `0 1px 0 0 ${p.theme.tokens.interactive.chonky.debossed.neutral.chonk} inset`
    )};
`;
