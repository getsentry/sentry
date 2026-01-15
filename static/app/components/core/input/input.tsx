import isPropValid from '@emotion/is-prop-valid';
import {type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {type FormSize, type StrictCSSObject} from 'sentry/utils/theme';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'readOnly'>,
    InputStylesProps {
  ref?: React.Ref<HTMLInputElement>;
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
export const Input = styled(
  ({
    ref,
    // Do not forward `size` since it's used for custom styling, not as the
    // native `size` attribute (for that, use `nativeSize` instead)
    size: _size,

    // Use `nativeSize` as the native `size` attribute
    nativeSize,

    ...props
  }: InputProps) => <input {...props} ref={ref} size={nativeSize} />,
  {shouldForwardProp: prop => prop === 'nativeSize' || isPropValid(prop)}
)`
  ${p => inputStyles(p)};
`;

export interface InputStylesProps {
  monospace?: boolean;
  nativeSize?: React.InputHTMLAttributes<HTMLInputElement>['size'];
  readOnly?: React.InputHTMLAttributes<HTMLInputElement>['readOnly'];
  size?: FormSize;
  type?: React.HTMLInputTypeAttribute;
}

export const inputStyles = ({
  theme,
  monospace,
  readOnly,
  size = 'md',
}: InputStylesProps & {theme: Theme}): StrictCSSObject => {
  const boxShadow = `0px 1px 0px 0px ${theme.tokens.interactive.chonky.debossed.neutral.chonk} inset`;

  return {
    display: 'block',
    width: '100%',
    color: theme.tokens.content.primary,
    backgroundColor: theme.tokens.interactive.chonky.debossed.neutral.background,
    boxShadow,
    border: `1px solid ${theme.tokens.border.primary}`,
    fontFamily: theme.font.family[monospace ? 'mono' : 'sans'],
    fontWeight: theme.font.weight[monospace ? 'mono' : 'sans'].regular,
    resize: 'vertical',
    transition: `border ${theme.motion.smooth.fast}, box-shadow ${theme.motion.smooth.fast}`,
    ...(readOnly ? {cursor: 'default'} : {}),

    fontSize: theme.form[size].fontSize,
    height: theme.form[size].height,
    lineHeight: theme.form[size].lineHeight,
    minHeight: theme.form[size].minHeight,

    paddingBottom: theme.form[size].paddingBottom,
    paddingLeft: theme.form[size].paddingLeft,
    paddingRight: theme.form[size].paddingRight,
    paddingTop: theme.form[size].paddingTop,

    borderRadius: theme.form[size].borderRadius,

    '&::placeholder': {
      color: theme.tokens.content.secondary,
      opacity: 1,
    },

    "&[disabled], &[aria-disabled='true']": {
      color: theme.tokens.content.disabled,
      cursor: 'not-allowed',
      opacity: '60%',

      '&::placeholder': {
        color: theme.tokens.content.disabled,
      },
    },

    '&:focus, &:focus-visible, :focus-within': {
      ...theme.focusRing(boxShadow),
    },
    "&[type='number']": {
      appearance: 'textfield',
      MozAppearance: 'textfield',
      fontVariantNumeric: 'tabular-nums',
    },
    '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
      WebkitAppearance: 'none',
      margin: 0,
    },
  };
};
