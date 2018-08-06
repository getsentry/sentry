import PropTypes from 'prop-types';
import React from 'react';
import TextareaAutosize from 'react-autosize-textarea';
import styled from 'react-emotion';

import {inputStyles} from 'app/styles/input';

class TextareaOrAutosize extends React.Component {
  static propTypes = {
    /**
     * Enable autosizing of the textarea.
     */
    autosize: PropTypes.bool,

    /**
     * Number of rows to start with if autosize
     */
    rows: PropTypes.number,

    innerRef: PropTypes.func,
  };

  render() {
    let {
      autosize,
      rows,
      innerRef,
      highlighted, // eslint-disable-line
      field, // eslint-disable-line
      multiline, // eslint-disable-line
      getValue, // eslint-disable-line
      setValue, // eslint-disable-line
      error, // eslint-disable-line
      initialData, // eslint-disable-line
      getData, // eslint-disable-line
      extraHelp, // eslint-disable-line
      ...props
    } = this.props;

    if (autosize) {
      return (
        <TextareaAutosize
          rows={rows ? rows : 2}
          async={true}
          innerRef={innerRef}
          {...props}
        />
      );
    }

    return <textarea {...props} ref={innerRef} />;
  }
}

const TextArea = styled(TextareaOrAutosize)`
  ${inputStyles};
`;

export default TextArea;
