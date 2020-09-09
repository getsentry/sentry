import space from 'app/styles/space';

/**
 * Note this is an object for `react-mentions` component and
 * not a styled component/emotion style
 */
export default function mentionStyle({minHeight = 140}) {
  return {
    control: {
      backgroundColor: '#fff',
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
        fontFamily: 'Rubik, Avenir Next, Helvetica Neue, sans-serif',
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
        backgroundColor: 'white',
        border: '1px solid rgba(0,0,0,0.15)',
        fontSize: 12,
      },

      item: {
        padding: '5px 15px',
        borderBottom: '1px solid rgba(0,0,0,0.15)',

        '&focused': {
          backgroundColor: '#f8f6f9',
        },
      },
    },
  };
}
