import * as React from 'react';
import TextareaAutosize from 'react-autosize-textarea';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {inputStyles} from 'sentry/styles/input';
import space from 'sentry/styles/space';

type InputProps = Omit<Parameters<typeof inputStyles>[0], 'theme'>;
type Props = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'css'> &
  InputProps & {
    /**
     * Enable autosizing of the textarea.
     */
    autosize?: boolean;
    /**
     * Max number of rows to default to.
     */
    maxRows?: number;
    /**
     * Number of rows to default to.
     */
    rows?: number;
  };

const TextAreaControl = React.forwardRef(function TextAreaControl(
  {autosize, rows, maxRows, ...p}: Props,
  ref: React.Ref<HTMLTextAreaElement>
) {
  return autosize ? (
    <TextareaAutosize {...p} async ref={ref} rows={rows ? rows : 2} maxRows={maxRows} />
  ) : (
    <textarea ref={ref} {...p} />
  );
});

TextAreaControl.displayName = 'TextAreaControl';

const propFilter = (p: string) =>
  ['autosize', 'rows', 'maxRows'].includes(p) || isPropValid(p);

const TextArea = styled(TextAreaControl, {shouldForwardProp: propFilter})`
  ${inputStyles};
  min-height: 40px;
  padding: calc(${space(1)} - 1px) ${space(1)};
  line-height: 1.5em;
  ${p =>
    p.autosize &&
    `
      height: auto;
      padding: calc(${space(1)} - 2px) ${space(1)};
      line-height: 1.6em;
    `}
`;

export default TextArea;
