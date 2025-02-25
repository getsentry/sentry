import {forwardRef} from 'react';
import TextareaAutosize, {type TextareaAutosizeProps} from 'react-textarea-autosize';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import type {InputStylesProps} from 'sentry/components/core/input';
import {inputStyles} from 'sentry/components/core/input';

export interface TextAreaProps
  extends Omit<
      React.TextareaHTMLAttributes<HTMLTextAreaElement>,
      'css' | 'onResize' | 'style'
    >,
    InputStylesProps {
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
  style?: TextareaAutosizeProps['style'];
}

const TextAreaControl = forwardRef(function TextAreaControl(
  {autosize, rows, maxRows, size: _size, ...p}: TextAreaProps,
  ref: React.Ref<HTMLTextAreaElement>
) {
  return autosize ? (
    <TextareaAutosize {...p} ref={ref} rows={rows ? rows : 2} maxRows={maxRows} />
  ) : (
    <textarea ref={ref} {...p} />
  );
});

TextAreaControl.displayName = 'TextAreaControl';

const TextArea = styled(TextAreaControl, {
  shouldForwardProp: (p: string) =>
    ['autosize', 'rows', 'maxRows'].includes(p) || isPropValid(p),
})`
  ${inputStyles};
  line-height: ${p => p.theme.text.lineHeightBody};

  /** Allow react-textarea-autosize to freely control height based on props. */
  ${p =>
    p.autosize &&
    `
      height: unset;
      min-height: unset;
    `}
`;

export default TextArea;
