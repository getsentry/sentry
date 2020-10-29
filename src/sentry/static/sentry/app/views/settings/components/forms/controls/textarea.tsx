import PropTypes from 'prop-types';
import React from 'react';
import TextareaAutosize from 'react-autosize-textarea';
import styled from '@emotion/styled';
import isPropValid from '@emotion/is-prop-valid';

import {inputStyles} from 'app/styles/input';

type InputProps = Omit<Parameters<typeof inputStyles>[0], 'theme'>;
type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> &
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

const TextAreaControl = React.forwardRef(function TextAreaControl(
  {autosize, rows, ...p}: Props,
  ref: React.Ref<HTMLTextAreaElement>
) {
  return autosize ? (
    <TextareaAutosize async ref={ref} rows={rows ? rows : 2} {...p} />
  ) : (
    <textarea ref={ref} {...p} />
  );
});

TextAreaControl.displayName = 'TextAreaControl';

TextAreaControl.propTypes = {
  autosize: PropTypes.bool,
  rows: PropTypes.number,
  monospace: PropTypes.bool,
};

const propFilter = (p: string) =>
  ['autosize', 'rows', 'maxRows'].includes(p) || isPropValid(p);

const TextArea = styled(TextAreaControl, {shouldForwardProp: propFilter})`
  ${inputStyles};
  line-height: 1.3em;
`;

export default TextArea;
