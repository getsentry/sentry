import {debossedBackground} from 'sentry/components/core/chonk';
import type {DO_NOT_USE_ChonkTheme, StrictCSSObject} from 'sentry/utils/theme';

import type {InputStylesProps} from './input';

export const chonkInputStyles = ({
  theme,
  monospace,
  readOnly,
  size = 'md',
}: InputStylesProps & {theme: DO_NOT_USE_ChonkTheme}): StrictCSSObject => {
  const boxShadow = `0px 1px 0px 0px ${theme.tokens.border.primary} inset`;

  return {
    display: 'block',
    width: '100%',
    color: theme.tokens.content.primary,
    ...debossedBackground(theme),
    boxShadow,
    border: `1px solid ${theme.tokens.border.primary}`,
    fontWeight: theme.fontWeight.normal,
    resize: 'vertical',
    transition: `border ${theme.motion.smooth.fast}, box-shadow ${theme.motion.smooth.fast}`,
    ...(monospace ? {fontFamily: theme.text.familyMono} : {}),
    ...(readOnly ? {cursor: 'default'} : {}),

    ...theme.form[size],
    ...theme.formPadding[size],
    ...theme.formRadius[size],

    '&::placeholder': {
      color: theme.tokens.content.muted,
      opacity: 1,
    },

    "&[disabled], &[aria-disabled='true']": {
      color: theme.disabled,
      cursor: 'not-allowed',
      opacity: '60%',

      '&::placeholder': {
        color: theme.disabled,
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
