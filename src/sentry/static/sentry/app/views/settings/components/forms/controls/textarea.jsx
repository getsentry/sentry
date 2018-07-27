import PropTypes from 'prop-types';
import React from 'react';
import TextareaAutosize from 'react-autosize-textarea';
import styled from 'react-emotion';
import isPropValid from '@emotion/is-prop-valid';

import {inputStyles} from 'app/styles/input';

const TextAreaControl = React.forwardRef(
  ({autosize, ...p}, ref) =>
    autosize ? (
      <TextareaAutosize async innerRef={ref} rows={p.rows ? p.rows : 2} {...p} />
    ) : (
      <textarea ref={ref} {...p} />
    )
);

TextAreaControl.propTypes = {
  /**
   * Enable autosizing of the textarea.
   */
  autosize: PropTypes.bool,
};

const propFilter = p => ['autosize', 'rows', 'maxRows'].includes(p) || isPropValid(p);

const TextArea = styled(TextAreaControl, {shouldForwardProp: propFilter})`
  ${inputStyles};
`;

export default TextArea;
