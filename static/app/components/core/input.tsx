import {forwardRef} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {chonkInputStyles} from 'sentry/components/core/input.chonk';
import type {FormSize} from 'sentry/utils/theme';

export interface InputStylesProps {
  monospace?: boolean;
  nativeSize?: React.InputHTMLAttributes<HTMLInputElement>['size'];
  readOnly?: React.InputHTMLAttributes<HTMLInputElement>['readOnly'];
  size?: FormSize;
  type?: React.HTMLInputTypeAttribute;
}

const inputStyles = (p: InputStylesProps & {theme: Theme}) => css`
  display: block;
  width: 100%;
  color: ${p.theme.formText};
  background: ${p.theme.background};
  border: 1px solid ${p.theme.border};
  border-radius: ${p.theme.borderRadius};
  box-shadow: inset ${p.theme.dropShadowMedium};
  resize: vertical;
  transition:
    border 0.1s,
    box-shadow 0.1s;

  ${p.monospace ? `font-family: ${p.theme.text.familyMono};` : ''}
  ${p.readOnly ? 'cursor: default;' : ''}

  ${p.theme.form[p.size ?? 'md']}
  ${p.theme.formPadding[p.size ?? 'md']}

  &::placeholder {
    color: ${p.theme.formPlaceholder};
    opacity: 1;
  }

  &[disabled],
  &[aria-disabled='true'] {
    background: ${p.theme.background};
    color: ${p.theme.disabled};
    cursor: not-allowed;

    &::placeholder {
      color: ${p.theme.disabled};
    }
  }

  &:focus,
  &:focus-visible {
    outline: none;
    border-color: ${p.theme.focusBorder};
    box-shadow: ${p.theme.focusBorder} 0 0 0 1px;
  }
  &[type='number'] {
    appearance: textfield;
    -moz-appearance: textfield;
    font-variant-numeric: tabular-nums;
  }
  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
`;

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'readOnly'>,
    InputStylesProps {}

/**
 * Basic input component.
 *
 * Use the `size` prop ('md', 'sm', 'xs') to control the input's height &
 * padding. To use the native size attribute (which controls the number of
 * characters the input should fit), use the `nativeSize` prop instead.
 *
 * To add leading/trailing items (e.g. a search icon on the left side), use
 * InputControl (components/inputControl) instead.
 */
export const Input = styled(
  forwardRef<HTMLInputElement, InputProps>(
    (
      {
        // Do not forward `required` to avoid default browser behavior
        required: _required,
        // Do not forward `size` since it's used for custom styling, not as the
        // native `size` attribute (for that, use `nativeSize` instead)
        size: _size,
        // Use `nativeSize` as the native `size` attribute
        nativeSize,
        ...props
      },
      ref
    ) => <input {...props} ref={ref} size={nativeSize} />
  ),
  {shouldForwardProp: prop => typeof prop === 'string' && isPropValid(prop)}
)`
  ${p => (p.theme.isChonk ? chonkInputStyles(p as any) : inputStyles(p))}
`;
