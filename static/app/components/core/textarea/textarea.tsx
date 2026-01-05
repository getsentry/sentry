import TextareaAutosize, {type TextareaAutosizeProps} from 'react-textarea-autosize';
import isPropValid from '@emotion/is-prop-valid';
import {css} from '@emotion/react';
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
  ref?: React.Ref<HTMLTextAreaElement>;
  /**
   * Number of rows to default to.
   */
  rows?: number;
  style?: TextareaAutosizeProps['style'];
}

function TextAreaControl({
  ref,
  autosize,
  rows = 3,
  maxRows,
  size: _size,
  ...p
}: TextAreaProps) {
  return autosize ? (
    <TextareaAutosize {...p} ref={ref} rows={rows} maxRows={maxRows} />
  ) : (
    <textarea ref={ref} {...p} rows={rows} />
  );
}

TextAreaControl.displayName = 'TextAreaControl';

const StyledTextArea = styled(TextAreaControl, {
  shouldForwardProp: (p: string) => ['autosize', 'maxRows'].includes(p) || isPropValid(p),
})`
  ${inputStyles};
  line-height: ${p => p.theme.font.lineHeight.comfortable};
  /** Allow react-textarea-autosize to freely control height based on props. */
  ${p =>
    p.autosize &&
    css`
      height: unset;
      min-height: unset;
    `}
`;

export const TextArea = styled(StyledTextArea)`
  /* re-set height to let it be determined by the rows prop */
  height: unset;
  /* this calculation reduces padding to account for the line-height, which ensures text is still correctly centered. */
  ${({theme, size = 'md'}) => `padding-top: calc(
      (${theme.form[size].height} -
        (${theme.form[size].fontSize} * ${theme.font.lineHeight.comfortable})
      ) / 2
    )`};
  ${({theme, size = 'md'}) => `padding-bottom: calc(
      (${theme.form[size].height} -
        (${theme.form[size].fontSize} * ${theme.font.lineHeight.comfortable})
      ) / 2
    )`};
`;
