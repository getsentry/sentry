import type {CSSProperties} from 'react';
import type {Theme} from '@emotion/react';

type Options = {
  theme: Theme;
  inputStyle?: CSSProperties;
  minHeight?: number;
};

/**
 * Returns the `style` object for react-mentions `MentionsInput`.
 */
export function mentionStyle({theme, minHeight, inputStyle}: Options) {
  const inputProps: CSSProperties = {
    fontSize: theme.font.size.md,
    padding: `${theme.space.lg} ${theme.space.lg}`,
    outline: 0,
    border: 0,
    minHeight,
    overflow: 'auto',
    overflowWrap: 'break-word',
    ...inputStyle,
  };

  return {
    control: {
      backgroundColor: 'transparent',
      fontSize: theme.font.size.md,
      fontWeight: 'normal' as const,
    },

    input: {
      margin: 0,
    },

    '&multiLine': {
      control: {
        fontFamily: theme.font.family.sans,
        minHeight,
      },

      highlighter: inputProps,
      input: inputProps,
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
