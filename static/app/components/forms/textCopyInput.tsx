import {Component, createRef} from 'react';
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

class TextCopyInput extends Component<Props> {
  textRef = createRef<HTMLInputElement>();

  // Select text when copy button is clicked
  handleCopyClick = (e: React.MouseEvent) => {
    if (!this.textRef.current) {
      return;
    }

    const {onCopy, children} = this.props;

    this.handleSelectText();

    onCopy?.(children, e);

    e.stopPropagation();
  };

  handleSelectText = () => {
    const {rtl} = this.props;

    if (!this.textRef.current) {
      return;
    }

    // We use findDOMNode here because `this.textRef` is not a dom node,
    // it's a ref to AutoSelectText
    const node = findDOMNode(this.textRef.current); // eslint-disable-line react/no-find-dom-node
    if (!node || !(node instanceof HTMLElement)) {
      return;
    }

    if (rtl && node instanceof HTMLInputElement) {
      // we don't want to select the first character - \u202A, nor the last - \u202C
      node.setSelectionRange(1, node.value.length - 1);
    } else {
      selectText(node);
    }
  };

  render() {
    const {
      className,
      disabled,
      style,
      children,
      rtl,
      size,
      onCopy: _onCopy,
      ...inputProps
    } = this.props;

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
        <OverflowContainer>
          <StyledInput
            readOnly
            disabled={disabled}
            ref={this.textRef}
            style={style}
            value={inputValue}
            onClick={this.handleSelectText}
            size={size}
            rtl={rtl}
            {...inputProps}
          />
        </OverflowContainer>
        <Clipboard hideUnsupported value={children}>
          <StyledCopyButton
            type="button"
            size={size}
            disabled={disabled}
            onClick={this.handleCopyClick}
          >
            <IconCopy size={size === 'xs' ? 'xs' : 'sm'} />
          </StyledCopyButton>
        </Clipboard>
      </Wrapper>
    );
  }
}

export default TextCopyInput;

const Wrapper = styled('div')`
  display: flex;
`;

export const StyledInput = styled(Input)<{rtl?: boolean}>`
  position: relative;
  border-right-width: 0;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  direction: ${p => (p.rtl ? 'rtl' : 'ltr')};

  &:focus {
    z-index: 1;
    border-right-width: 1px;
  }
`;

const OverflowContainer = styled('div')`
  flex-grow: 1;
  border: none;
`;

export const StyledCopyButton = styled(Button)`
  flex-shrink: 1;
  border-radius: 0 0.25em 0.25em 0;
  box-shadow: none;
`;
