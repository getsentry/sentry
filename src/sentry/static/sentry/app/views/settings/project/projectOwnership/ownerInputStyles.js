let styles = {
  control: {
    backgroundColor: '#fff',
    fontSize: 15,
    fontWeight: 'normal',
  },

  input: {
    margin: 0,
    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
    wordBreak: 'break-all',
    whiteSpace: 'pre-wrap',
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
      fontFamily: 'Monaco, Consolas, "Courier New", monospace',
    },

    highlighter: {
      padding: 20,
    },

    input: {
      padding: '5px 5px 0',
      minHeight: 140,
      overflow: 'auto',
      outline: 0,
      border: '1 solid',
    },
  },

  suggestions: {
    list: {
      maxHeight: 150,
      overflow: 'auto',
      backgroundColor: 'white',
      border: '1px solid rgba(0,0,0,0.15)',
      fontSize: 15,
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

export default styles;
