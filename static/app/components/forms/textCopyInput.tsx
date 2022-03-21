import {CSSProperties} from 'react';
import * as React from 'react';
import ReactDOM from 'react-dom';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Clipboard from 'sentry/components/clipboard';
import {IconCopy} from 'sentry/icons';
import {inputStyles} from 'sentry/styles/input';
import {selectText} from 'sentry/utils/selectText';

const Wrapper = styled('div')`
  display: flex;
`;

const StyledInput = styled('input')<{rtl?: boolean}>`
  ${inputStyles};
  background-color: ${p => p.theme.backgroundSecondary};
  border-right-width: 0;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  direction: ${p => (p.rtl ? 'rtl' : 'ltr')};

  &:hover,
  &:focus {
    background-color: ${p => p.theme.backgroundSecondary};
    border-right-width: 0;
  }
`;

const OverflowContainer = styled('div')`
  flex-grow: 1;
  border: none;
`;

const StyledCopyButton = styled(Button)`
  flex-shrink: 1;
  border-radius: 0 0.25em 0.25em 0;
  box-shadow: none;
`;

type Props = {
  /**
   * Text to copy
   */
  children: string;
  onCopy?: (value: string, event: React.MouseEvent) => void;
  /**
   * Always show the ending of a long overflowing text in input
   */
  rtl?: boolean;
  style?: CSSProperties;
};

class TextCopyInput extends React.Component<Props> {
  textRef = React.createRef<HTMLInputElement>();

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
    const node = ReactDOM.findDOMNode(this.textRef.current); // eslint-disable-line react/no-find-dom-node
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
    const {style, children, rtl} = this.props;

    /**
     * We are using direction: rtl; to always show the ending of a long overflowing text in input.
     *
     * This however means that the trailing characters with BiDi class O.N. ('Other Neutrals') goes to the other side.
     * Hello! becomes !Hello and vice versa. This is a problem for us when we want to show path in this component, because
     * /user/local/bin becomes user/local/bin/. Wrapping in unicode characters for left-to-righ embedding solves this,
     * however we need to be aware of them when selecting the text - we are solving that by offseting the selectionRange.
     */
    const inputValue = rtl ? '\u202A' + children + '\u202C' : children;

    return (
      <Wrapper>
        <OverflowContainer>
          <StyledInput
            readOnly
            ref={this.textRef}
            style={style}
            value={inputValue}
            onClick={this.handleSelectText}
            rtl={rtl}
          />
        </OverflowContainer>
        <Clipboard hideUnsupported value={children}>
          <StyledCopyButton type="button" onClick={this.handleCopyClick}>
            <IconCopy />
          </StyledCopyButton>
        </Clipboard>
      </Wrapper>
    );
  }
}

export default TextCopyInput;
