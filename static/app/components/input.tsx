import {forwardRef} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {FormSize} from 'sentry/utils/theme';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  leadingWidth?: number;
  monospace?: boolean;
  nativeSize?: React.InputHTMLAttributes<HTMLInputElement>['size'];
  size?: FormSize;
  trailingWidth?: number;
  type?: React.HTMLInputTypeAttribute;
}

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
const Input = styled(
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
  {
    shouldForwardProp: prop => typeof prop === 'string' && isPropValid(prop),
  }
)`
  display: block;
  width: 100%;
  color: ${p => p.theme.formText};
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: inset ${p => p.theme.dropShadowLight};
  resize: vertical;
  transition: border 0.1s, box-shadow 0.1s;

  ${p => (p.monospace ? `font-family: ${p.theme.text.familyMono}` : '')};
  ${p => (p.readOnly ? 'cursor: default;' : '')};

  ${p => p.theme.form[p.size ?? 'md']}
  ${p => p.theme.formPadding[p.size ?? 'md']}
  ${p =>
    p.leadingWidth &&
    `padding-left: calc(
      ${p.leadingWidth}px +
      ${p.theme.formPadding[p.size ?? 'md'].paddingLeft}px * 1.618
    );`} /* 1.618 cause golden ratio! */
  ${p =>
    p.trailingWidth &&
    `padding-right: calc(
      ${p.trailingWidth}px +
      ${p.theme.formPadding[p.size ?? 'md'].paddingRight}px * 1.618
    );`} /* 1.618 cause golden ratio! */

  &::placeholder {
    color: ${p => p.theme.formPlaceholder};
    opacity: 1;
  }

  &[disabled] {
    background: ${p => p.theme.backgroundSecondary};
    color: ${p => p.theme.disabled};
    cursor: not-allowed;

    &::placeholder {
      color: ${p => p.theme.disabled};
    }
  }

  &:focus,
  &.focus-visible {
    outline: none;
    border-color: ${p => p.theme.focusBorder};
    box-shadow: ${p => p.theme.focusBorder} 0 0 0 1px;
  }
`;

export default Input;
