import {Theme} from '@emotion/react';

import {space} from 'sentry/styles/space';

type Options = {
  theme: Theme;
  minHeight?: number;
};

/**
 * Note this is an object for `react-mentions` component and
 * not a styled component/emotion style
 */
export function mentionStyle({theme, minHeight}: Options) {
  const inputProps = {
    fontSize: theme.fontSizeMedium,
    padding: `${space(1.5)} ${space(2)}`,
    outline: 0,
    border: 0,
    minHeight,
    overflow: 'auto',
  };

  return {
    control: {
      backgroundColor: `${theme.background}`,
      fontSize: 15,
      fontWeight: 'normal',
    },

    input: {
      margin: 0,
    },

    '&singleLine': {
      control: {
        display: 'inline-block',
        width: 130,
      },

      highlighter: {
        padding: 1,
        border: '2px inset transparent',
      },

      input: {
        padding: 1,
        border: '2px inset',
      },
    },

    '&multiLine': {
      control: {
        fontFamily: theme.text.family,
        minHeight,
      },

      // Use the same props for the highliter to keep the phantom text aligned
      highlighter: inputProps,
      input: inputProps,
    },

    suggestions: {
      list: {
        maxHeight: 142,
        minWidth: 220,
        overflow: 'auto',
        backgroundColor: `${theme.background}`,
        border: '1px solid rgba(0,0,0,0.15)',
        borderRadius: theme.borderRadius,
        fontSize: theme.fontSizeSmall,
        padding: space(0.5),
      },

      item: {
        padding: space(0.5),
        borderRadius: theme.borderRadius,
        '&focused': {
          backgroundColor: theme.hover,
        },
      },
    },
  };
}
