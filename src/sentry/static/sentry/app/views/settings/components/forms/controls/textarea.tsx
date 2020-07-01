import PropTypes from 'prop-types';
import React from 'react';
import TextareaAutosize from 'react-autosize-textarea';
import styled from '@emotion/styled';
import isPropValid from '@emotion/is-prop-valid';

import {inputStyles} from 'app/styles/input';

type TextAreaProps = Omit<React.HTMLProps<HTMLTextAreaElement>, 'ref'>;
type InputProps = Omit<Parameters<typeof inputStyles>[0], 'theme'>;
type Props = TextAreaProps &
  InputProps & {
    /**
     * Enable autosizing of the textarea.
     */
    autosize?: boolean;
    /**
     * Number of rows to default to.
     */
    rows?: number;
  };

const TextAreaControl = React.forwardRef<HTMLTextAreaElement, Props>(
  ({autosize, rows, ...p}, ref) =>
    autosize ? (
      <TextareaAutosize async ref={ref} rows={rows ? rows : 2} {...p} />
    ) : (
      <textarea ref={ref} {...p} />
    )
);

TextAreaControl.propTypes = {
  autosize: PropTypes.bool,
  rows: PropTypes.number,
  monospace: PropTypes.bool,
};

const propFilter = (p: string) =>
  ['autosize', 'rows', 'maxRows'].includes(p) || isPropValid(p);

const TextArea = styled(TextAreaControl, {shouldForwardProp: propFilter})`
  ${inputStyles};
`;

export default TextArea;
