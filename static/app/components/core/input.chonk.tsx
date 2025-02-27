import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';

import type {InputStylesProps} from 'sentry/components/core/input';
import type {StrictCSSObject} from 'sentry/utils/theme';

export const chonkInputStyles = (
  p: InputStylesProps & {theme: DO_NOT_USE_ChonkTheme}
): StrictCSSObject => ({
  display: 'block',
  width: '100%',
  color: p.theme.textColor,
  background: p.theme.background,
  border: `1px solid ${p.theme.border}`,
  borderRadius: p.theme.borderRadius,
  boxShadow: `inset ${p.theme.dropShadowMedium}`,
  resize: 'vertical',
  transition: 'border 0.1s, box-shadow 0.1s',
  ...(p.monospace ? {fontFamily: p.theme.text.familyMono} : {}),
  ...(p.readOnly ? {cursor: 'default'} : {}),

  ...p.theme.form[p.size ?? 'md'],
  ...p.theme.formPadding[p.size ?? 'md'],

  '&::placeholder': {
    color: p.theme.subText,
    opacity: 1,
  },

  "&[disabled], &[aria-disabled='true']": {
    color: p.theme.disabled,
    cursor: 'not-allowed',

    '&::placeholder': {
      color: p.theme.disabled,
    },
  },

  '&:focus, &:focus-visible': {
    outline: 'none',
    boxShadow: `0 0 0 2px ${p.theme.background}, 0 0 0 4px ${p.theme.focusBorder}`,
    borderRadius: `calc(${p.theme.borderRadius} + 2px)`,
  },
  "&[type='number']": {
    appearance: 'textfield',
    MozAppearance: 'textfield',
    'font-variant-numeric': 'tabular-nums',
  },
  '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
    WebkitAppearance: 'none',
    margin: 0,
  },
});
