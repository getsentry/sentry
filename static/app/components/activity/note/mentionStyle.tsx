import type {Theme} from '@emotion/react';

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
    fontSize: theme.font.size.md,
    padding: `${theme.space.lg} ${theme.space.xl}`,
    outline: 0,
    border: 0,
    minHeight,
    overflow: 'auto',
  };

  const streamlinedInputProps = {
    fontSize: theme.font.size.md,
    padding: `${theme.space.md} ${theme.space.lg}`,
    outline: 0,
    border: `1px solid ${theme.tokens.border.primary}`,
    borderRadius: theme.radius.md,
    minHeight,
    overflow: 'auto',
  };

  return {
    control: {
      backgroundColor: theme.tokens.background.primary,
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
        fontFamily: theme.font.family.sans,
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
        backgroundColor: theme.tokens.background.primary,
        border: '1px solid rgba(0,0,0,0.15)',
        borderRadius: theme.radius.md,
        fontSize: theme.font.size.sm,
        padding: theme.space.xs,
      },

      item: {
        padding: theme.space.xs,
        borderRadius: theme.radius.md,
        '&focused': {
          backgroundColor: theme.tokens.interactive.transparent.neutral.background.active,
        },
      },
    },
  };
}
