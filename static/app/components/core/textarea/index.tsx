import {forwardRef} from 'react';
import TextareaAutosize, {type TextareaAutosizeProps} from 'react-textarea-autosize';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {Input, type InputStylesProps} from 'sentry/components/core/input';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';
import {withChonk} from 'sentry/utils/theme/withChonk';

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
  {autosize, rows = 3, maxRows, size: _size, ...p}: TextAreaProps,
  ref: React.Ref<HTMLTextAreaElement>
) {
  return autosize ? (
    <TextareaAutosize {...p} ref={ref} rows={rows} maxRows={maxRows} />
  ) : (
    <textarea ref={ref} {...p} rows={rows} />
  );
});

TextAreaControl.displayName = 'TextAreaControl';

const StyledTextArea = styled(Input.withComponent(TextAreaControl), {
  shouldForwardProp: (p: string) => ['autosize', 'maxRows'].includes(p) || isPropValid(p),
})`
  line-height: ${p => p.theme.text.lineHeightBody};
  /** Allow react-textarea-autosize to freely control height based on props. */
  ${p =>
    p.autosize &&
    `
      height: unset;
      min-height: unset;
    `}
` as unknown as typeof TextAreaControl;

export const TextArea = withChonk(
  StyledTextArea,
  chonkStyled(StyledTextArea)`
    /* re-set height to let it be determined by the rows prop */
    height: unset;
    /* this calculation reduces padding to account for the line-height, which ensures text is still correctly centered. */
    ${({theme, size = 'md'}) => `padding-top: calc(
      (${theme.form[size].height} -
        (${theme.form[size].fontSize} * ${theme.text.lineHeightBody})
      ) / 2
    )`};
    ${({theme, size = 'md'}) => `padding-bottom: calc(
      (${theme.form[size].height} -
        (${theme.form[size].fontSize} * ${theme.text.lineHeightBody})
      ) / 2
    )`};
`
);
