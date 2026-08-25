import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {
  OTPInput as OTPInputPrimitive,
  REGEXP_ONLY_DIGITS,
  REGEXP_ONLY_DIGITS_AND_CHARS,
} from 'input-otp';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {useTranslation} from '@sentry/scraps/translationContext';

import {inputStyles} from './inputStyles';

type FormatToken = '0' | 'A';
type FormatParserState = 'start' | 'token' | 'separator';

/**
 * Type-level parsing machinery for OTP formats. It walks the format one character at
 * a time, remembers whether the first input token was `0` or `A`, and rejects formats
 * that mix the two token types. The parser state also prevents leading, trailing, or
 * consecutive separators. This type has no runtime behavior; it exists solely to
 * provide useful TypeScript errors at OTPInput call sites.
 */
type IsValidOTPFormat<
  Format extends string,
  SelectedToken extends FormatToken | null = null,
  State extends FormatParserState = 'start',
> = Format extends ''
  ? State extends 'token'
    ? true
    : false
  : Format extends `${infer Character}${infer Rest}`
    ? Character extends FormatToken
      ? SelectedToken extends null
        ? IsValidOTPFormat<Rest, Character, 'token'>
        : Character extends SelectedToken
          ? IsValidOTPFormat<Rest, SelectedToken, 'token'>
          : false
      : Character extends '-'
        ? State extends 'token'
          ? IsValidOTPFormat<Rest, SelectedToken, 'separator'>
          : false
        : false
    : false;

type OTPFormat<Format extends string> =
  IsValidOTPFormat<Format> extends true ? Format : never;

export interface OTPInputProps<Format extends string> {
  /**
   * Describes the accepted characters and visual grouping. Use `0` for numeric
   * inputs, `A` for alphanumeric inputs, and `-` for visual separators. A format
   * must use either `0` or `A` throughout. Separators are not included in the value.
   */
  format: OTPFormat<Format>;
  onComplete: (value: string) => void;
  disabled?: boolean;
  /** Converts alphanumeric input to uppercase as it is entered. */
  uppercase?: boolean;
}

/** @public */
export function OTPInput<const Format extends string>({
  format,
  onComplete,
  disabled = false,
  uppercase = false,
}: OTPInputProps<Format>) {
  const {t} = useTranslation();
  const [value, setValue] = useState('');
  const normalizeValue = (newValue: string) =>
    uppercase ? newValue.toUpperCase() : newValue;
  const formatCharacters = [...format];
  const isAlphanumeric = format.includes('A');
  const length = formatCharacters.filter(character => character !== '-').length;

  return (
    <OTPInputPrimitive
      aria-label={t('One-time password')}
      autoComplete="one-time-code"
      disabled={disabled}
      inputMode={isAlphanumeric ? 'text' : 'numeric'}
      maxLength={length}
      onChange={newValue => setValue(normalizeValue(newValue))}
      onComplete={(newValue: string) => onComplete(normalizeValue(newValue))}
      pasteTransformer={pastedValue => pastedValue.replaceAll('-', '')}
      pattern={isAlphanumeric ? REGEXP_ONLY_DIGITS_AND_CHARS : REGEXP_ONLY_DIGITS}
      render={({slots}) => (
        <Flex align="center" aria-hidden gap="xs" paddingRight="md">
          {formatCharacters.map((character, formatIndex) => {
            if (character === '-') {
              return (
                <Fragment key={formatIndex}>
                  <Flex align="center" paddingLeft="xs" paddingRight="xs">
                    {flexProps => (
                      <Text {...flexProps} as="span" size="lg">
                        -
                      </Text>
                    )}
                  </Flex>
                </Fragment>
              );
            }

            const slotIndex = formatCharacters
              .slice(0, formatIndex)
              .filter(formatCharacter => formatCharacter !== '-').length;
            const slot = slots[slotIndex];

            if (!slot) {
              return null;
            }

            return (
              <OTPInputSlot
                key={formatIndex}
                align="center"
                aria-hidden
                aria-disabled={disabled}
                data-input-otp-slot
                justify="center"
                $isActive={slot.isActive}
              >
                {slot.char ?? slot.placeholderChar}
              </OTPInputSlot>
            );
          })}
        </Flex>
      )}
      value={value}
    />
  );
}

const OTPInputSlot = styled(Flex)<{$isActive: boolean}>`
  ${p => inputStyles({theme: p.theme, size: 'md'})};
  display: flex;
  min-width: ${p => p.theme.form.md.height};
  padding: 0;
  width: ${p => p.theme.form.md.height};

  ${p =>
    p.$isActive &&
    p.theme.focusRing(
      `0 1px 0 0 ${p.theme.tokens.interactive.chonky.debossed.neutral.chonk} inset`
    )};
`;
