import type {Theme} from '@emotion/react';

import {space} from 'sentry/styles/space';

type Options = {
  theme: Theme;
  minHeight?: number;
  streamlined?: boolean;
};

/**
 * Note this is an object for `react-mentions` component and
 * not a styled component/emotion style
 */
export function mentionStyle({theme, minHeight, streamlined}: Options) {
  const inputProps = {
    fontSize: theme.fontSize.md,
    padding: `${space(1.5)} ${space(2)}`,
    outline: 0,
    border: 0,
    minHeight,
    overflow: 'auto',
  };

  const streamlinedInputProps = {
    fontSize: theme.fontSize.md,
    padding: `${space(1)} ${space(1.5)}`,
    outline: 0,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.radius.md,
    minHeight,
    overflow: 'auto',
  };

  return {
    control: {
      backgroundColor: `${theme.tokens.background.primary}`,
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
      highlighter: streamlined ? streamlinedInputProps : inputProps,
      input: streamlined ? streamlinedInputProps : inputProps,
    },

    suggestions: {
      list: {
        maxHeight: 142,
        minWidth: 220,
        overflow: 'auto',
        backgroundColor: `${theme.tokens.background.primary}`,
        border: '1px solid rgba(0,0,0,0.15)',
        borderRadius: theme.radius.md,
        fontSize: theme.fontSize.sm,
        padding: space(0.5),
      },

      item: {
        padding: space(0.5),
        borderRadius: theme.radius.md,
        '&focused': {
          backgroundColor: theme.hover,
        },
      },
    },
  };
}
