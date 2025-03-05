import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';

import type {InputStylesProps} from 'sentry/components/core/input';
import type {StrictCSSObject} from 'sentry/utils/theme';

export const chonkInputStyles = ({
  theme,
  monospace,
  readOnly,
  size = 'md',
}: InputStylesProps & {theme: DO_NOT_USE_ChonkTheme}): StrictCSSObject => ({
  display: 'block',
  width: '100%',
  color: theme.textColor,
  background: theme.background,
  border: `1px solid ${theme.border}`,
  fontWeight: theme.fontWeightNormal,
  resize: 'vertical',
  transition: 'border 0.1s, box-shadow 0.1s',
  ...(monospace ? {fontFamily: theme.text.familyMono} : {}),
  ...(readOnly ? {cursor: 'default'} : {}),

  ...theme.form[size],
  ...theme.formPadding[size],
  ...theme.formRadius[size],

  '&::placeholder': {
    color: theme.subText,
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
    outline: 'none',
    boxShadow: `0 0 0 2px ${theme.background}, 0 0 0 4px ${theme.focusBorder}`,
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
});
