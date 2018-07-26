import PropTypes from 'prop-types';
import React from 'react';
import TextareaAutosize from 'react-autosize-textarea';
import styled from 'react-emotion';

import {inputStyles} from 'app/styles/input';

const TextArea = styled(
  p =>
    p.autosize ? (
      <TextareaAutosize rows={p.rows ? p.rows : 2} async={true} {...p} />
    ) : (
      <textarea {...p} />
    )
)`
  ${inputStyles};
`;

TextArea.propTypes = {
  /**
   * Enable autosizing of the textarea.
   */
  autosize: PropTypes.bool,
};

export default TextArea;
