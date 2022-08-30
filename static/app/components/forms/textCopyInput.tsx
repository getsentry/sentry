import {useCallback, useRef} from 'react';
import {findDOMNode} from 'react-dom';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Clipboard from 'sentry/components/clipboard';
import Input, {InputProps} from 'sentry/components/input';
import {IconCopy} from 'sentry/icons';
import {selectText} from 'sentry/utils/selectText';

interface Props extends Omit<InputProps, 'onCopy'> {
  /**
   * Text to copy
   */
  children: string;
  className?: string;
  disabled?: boolean;
  onCopy?: (value: string, event: React.MouseEvent) => void;
  /**
   * Always show the ending of a long overflowing text in input
   */
  rtl?: boolean;
  style?: React.CSSProperties;
}

function TextCopyInput({
  className,
  disabled,
  style,
  onCopy,
  rtl,
  size,
  children,
  ...inputProps
}: Props) {
  const textRef = useRef<HTMLInputElement>(null);

  const handleSelectText = useCallback(() => {
    if (!textRef.current) {
      return;
    }

    // We use findDOMNode here because `this.textRef` is not a dom node,
    // it's a ref to AutoSelectText
    const node = findDOMNode(textRef.current); // eslint-disable-line react/no-find-dom-node
    if (!node || !(node instanceof HTMLElement)) {
      return;
    }

    if (rtl && node instanceof HTMLInputElement) {
      // we don't want to select the first character - \u202A, nor the last - \u202C
      node.setSelectionRange(1, node.value.length - 1);
    } else {
      selectText(node);
    }
  }, [rtl]);

  /**
   * Select text when copy button is clicked
   */
  const handleCopyClick = useCallback(
    (e: React.MouseEvent) => {
      if (!textRef.current) {
        return;
      }

      handleSelectText();

      onCopy?.(children, e);

      e.stopPropagation();
    },
    [handleSelectText, children, onCopy]
  );

  /**
   * We are using direction: rtl; to always show the ending of a long overflowing text in input.
   *
   * This however means that the trailing characters with BiDi class O.N. ('Other Neutrals') goes to the other side.
   * Hello! becomes !Hello and vice versa. This is a problem for us when we want to show path in this component, because
   * /user/local/bin becomes user/local/bin/. Wrapping in unicode characters for left-to-righ embedding solves this,
   * however we need to be aware of them when selecting the text - we are solving that by offsetting the selectionRange.
   */
  const inputValue = rtl ? '\u202A' + children + '\u202C' : children;

  return (
    <Wrapper className={className}>
      <StyledInput
        readOnly
        disabled={disabled}
        ref={textRef}
        style={style}
        value={inputValue}
        onClick={handleSelectText}
        size={size}
        rtl={rtl}
        {...inputProps}
      />
      <Clipboard hideUnsupported value={children}>
        <StyledCopyButton
          type="button"
          size={size}
          disabled={disabled}
          onClick={handleCopyClick}
        >
          <IconCopy size={size === 'xs' ? 'xs' : 'sm'} />
        </StyledCopyButton>
      </Clipboard>
    </Wrapper>
  );
}

export default TextCopyInput;

const Wrapper = styled('div')`
  display: flex;
`;

export const StyledInput = styled(Input)<{rtl?: boolean}>`
  position: relative;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-right-color: transparent;
  direction: ${p => (p.rtl ? 'rtl' : 'ltr')};

  &:focus {
    z-index: 1;
    border-right-color: ${p => p.theme.focusBorder};
  }
`;

export const StyledCopyButton = styled(Button)`
  flex-shrink: 0;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  box-shadow: none;
  transform: translateX(-1px);
`;
