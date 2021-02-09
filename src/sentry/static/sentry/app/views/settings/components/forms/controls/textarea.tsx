import React from 'react';
import TextareaAutosize from 'react-autosize-textarea';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {inputStyles} from 'app/styles/input';
import space from 'app/styles/space';

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
    /**
     * Max number of rows to default to.
     */
    maxRows?: number;
  };

const TextAreaControl = React.forwardRef(function TextAreaControl(
  {autosize, rows, maxRows, ...p}: Props,
  ref: React.Ref<HTMLTextAreaElement>
) {
  return autosize ? (
    <TextareaAutosize async ref={ref} rows={rows ? rows : 2} maxRows={maxRows} {...p} />
  ) : (
    <textarea ref={ref} {...p} />
  );
});

TextAreaControl.displayName = 'TextAreaControl';

const propFilter = (p: string) =>
  ['autosize', 'rows', 'maxRows'].includes(p) || isPropValid(p);

const TextArea = styled(TextAreaControl, {shouldForwardProp: propFilter})`
  ${inputStyles};
  padding: ${space(1)};
  line-height: 1.5em;
`;

export default TextArea;
