import {debossedBackground} from 'sentry/components/core/chonk';
import type {StrictCSSObject, Theme} from 'sentry/utils/theme';

import type {InputStylesProps} from './input';

export const chonkInputStyles = ({
  theme,
  monospace,
  readOnly,
  size = 'md',
}: InputStylesProps & {theme: Theme}): StrictCSSObject => {
  const boxShadow = `0px 1px 0px 0px ${theme.tokens.border.primary} inset`;

  return {
    display: 'block',
    width: '100%',
    color: theme.tokens.content.primary,
    ...debossedBackground(theme),
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
