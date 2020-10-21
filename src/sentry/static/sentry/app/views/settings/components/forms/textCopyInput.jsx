import PropTypes from 'prop-types';
import {createRef, Component} from 'react';
import ReactDOM from 'react-dom';
import styled from '@emotion/styled';

import {inputStyles} from 'app/styles/input';
import {selectText} from 'app/utils/selectText';
import Button from 'app/components/button';
import Clipboard from 'app/components/clipboard';
import {IconCopy} from 'app/icons';

const Wrapper = styled('div')`
  display: flex;
`;

const StyledInput = styled('input')`
  ${inputStyles};
  background-color: ${p => p.theme.gray100};
  border-right-width: 0;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  direction: ${p => (p.rtl ? 'rtl' : 'ltr')};

  &:hover,
  &:focus {
    background-color: ${p => p.theme.gray100};
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

class TextCopyInput extends Component {
  static propTypes = {
    /**
     * Text to copy
     */
    children: PropTypes.string.isRequired,
    /**
     * CSS style object
     */
    style: PropTypes.object,
    onCopy: PropTypes.func,
    /**
     * Always show the ending of a long overflowing text in input
     */
    rtl: PropTypes.bool,
  };

  static defaultProps = {
    onCopy: () => {},
  };

  constructor(props) {
    super(props);
    this.textRef = createRef();
  }

  // Select text when copy button is clicked
  handleCopyClick = e => {
    if (!this.textRef.current) {
      return;
    }

    const {onCopy} = this.props;

    this.handleSelectText();

    onCopy(this.props.children, e);

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

    if (rtl) {
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
        <Clipboard hideUnsupported onClick={this.handleCopyClick} value={children}>
          <StyledCopyButton type="button" size="xsmall" onClick={this.handleCopyClick}>
            <IconCopy />
          </StyledCopyButton>
        </Clipboard>
      </Wrapper>
    );
  }
}

export default TextCopyInput;
