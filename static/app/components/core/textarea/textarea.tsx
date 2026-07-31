import {useCallback, useMemo, useState} from 'react';
import TextareaAutosize, {type TextareaAutosizeProps} from 'react-textarea-autosize';
import isPropValid from '@emotion/is-prop-valid';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';

import {inputStyles, type InputStylesProps} from '@sentry/scraps/input/inputStyles';

export interface TextAreaProps
  extends
    Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'css' | 'onResize' | 'style'>,
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
    <AutosizeTextArea {...p} ref={ref} rows={rows} maxRows={maxRows} />
  ) : (
    <textarea ref={ref} {...p} rows={rows} />
  );
}

TextAreaControl.displayName = 'TextAreaControl';

interface AutosizeTextAreaProps extends Omit<TextAreaProps, 'autosize' | 'size'> {
  rows: number;
}

// react-textarea-autosize doesn't observe the element's own width, so
// container-driven resizes leave the height stale. Force a recompute on
// border-box width changes (border box ignores internal-scrollbar jitter).
function AutosizeTextArea({ref, rows, maxRows, ...p}: AutosizeTextAreaProps) {
  // we need to turn off the compiler here because we need to force text-area-auto-size
  // to recompute on width changes, even though we don't use the state variable.
  'use no memo';
  // Storing width in state re-renders on change so react-textarea-autosize recomputes
  const [, setWidth] = useState<number>();

  const observerRef = useCallback((node: HTMLTextAreaElement | null) => {
    if (!node) {
      return;
    }

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      const width = entry?.borderBoxSize?.[0]?.inlineSize ?? entry?.contentRect.width;
      setWidth(width);
    });
    observer.observe(node, {box: 'border-box'});

    return () => observer.disconnect();
  }, []);

  const mergedRef = useMemo(() => mergeRefs(ref, observerRef), [ref, observerRef]);

  return <TextareaAutosize {...p} ref={mergedRef} minRows={rows} maxRows={maxRows} />;
}

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
