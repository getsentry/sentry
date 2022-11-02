import space from 'sentry/styles/space';
import {Theme} from 'sentry/utils/theme';

type Options = {
  theme: Theme;
  minHeight?: number;
};

/**
 * Note this is an object for `react-mentions` component and
 * not a styled component/emotion style
 */
export default function mentionStyle({theme, minHeight}: Options) {
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

      highlighter: {
        padding: 20,
        minHeight,
      },

      input: {
        padding: `${space(1.5)} ${space(2)} 0`,
        minHeight,
        overflow: 'auto',
        outline: 0,
        border: 0,
      },
    },

    suggestions: {
      list: {
        maxHeight: 150,
        overflow: 'auto',
        backgroundColor: `${theme.background}`,
        border: '1px solid rgba(0,0,0,0.15)',
        borderRadius: theme.borderRadius,
        fontSize: theme.fontSizeSmall,
        padding: space(0.5),
      },

      item: {
        padding: '5px 15px',
        borderRadius: theme.borderRadius,
        '&focused': {
          backgroundColor: theme.hover,
        },
      },
    },
  };
}
