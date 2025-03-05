import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';

import type {RadioProps} from 'sentry/components/core/radio';
import {growIn} from 'sentry/styles/animations';
import type {StrictCSSObject} from 'sentry/utils/theme';

const radioConfig = {
  sm: {
    outerSize: '20px',
    innerSize: '10px',
  },
  md: {
    outerSize: '24px',
    innerSize: '12px',
  },
};

export const chonkRadioStyles = (
  props: RadioProps & {theme: DO_NOT_USE_ChonkTheme}
): StrictCSSObject => ({
  width: radioConfig[props.size ?? 'md'].outerSize,
  height: radioConfig[props.size ?? 'md'].outerSize,

  borderRadius: '50%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  appearance: 'none',
  transition: 'border 0.1s, box-shadow 0.1s',

  /* TODO(bootstrap): Our bootstrap CSS adds this, we can remove when we remove that */
  margin: '0 !important',
  border: `1px solid ${props.theme.colors.dynamic.surface100} !important`,

  '&:after': {
    content: '""',
    display: 'block',
    width: radioConfig[props.size ?? 'md'].innerSize,
    height: radioConfig[props.size ?? 'md'].innerSize,
    borderRadius: '50%',
    backgroundColor: props.theme.colors.static.white,
    transition: 'all 0.2s ease-in-out',
    opacity: 0,
  },

  '&:focus-visible': {
    outline: 'none',
    boxShadow: `0 0 0 2px ${props.theme.background}, 0 0 0 4px ${props.theme.focusBorder}`,
  },

  '&:checked': {
    backgroundColor: props.theme.colors.static.blue400,
    border: `1px solid ${props.theme.colors.static.blue400}`,

    '&:after': {
      animation: `${growIn} 0.2s ease-in-out`,
      opacity: 1,
    },
  },

  '&:disabled': {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
});
