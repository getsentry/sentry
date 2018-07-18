import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import styled from 'react-emotion';

import {inputStyles} from 'app/styles/input';
import {selectText} from 'app/utils/selectText';
import Button from 'app/components/buttons/button';
import Clipboard from 'app/components/clipboard';
import InlineSvg from 'app/components/inlineSvg';

const StyledInput = styled(props => {
  return <input {...props} />;
})`
  ${inputStyles};
  background-color: ${p => p.theme.offWhite};
  border-right-width: 0;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;

  &:hover,
  &:focus {
    background-color: ${p => p.theme.offWhite};
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

class TextCopyInput extends React.Component {
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
  };

  static defaultProps = {
    onCopy: () => {},
  };

  constructor(props) {
    super(props);
  }

  // Select text when copy button is clicked
  handleCopyClick = e => {
    if (!this.textRef) return;

    let {onCopy} = this.props;

    this.handleSelectText();

    onCopy(this.props.children, e);

    e.stopPropagation();
  };

  handleSelectText = () => {
    if (!this.textRef) return;

    // We use findDOMNode here because `this.textRef` is not a dom node,
    // it's a ref to AutoSelectText
    // eslint-disable-next-line react/no-find-dom-node
    selectText(ReactDOM.findDOMNode(this.textRef));
  };

  handleAutoMount = ref => {
    this.textRef = ref;
  };

  render() {
    let {style, children} = this.props;

    return (
      <Flex>
        <OverflowContainer>
          <StyledInput
            readOnly
            ref={this.handleAutoMount}
            style={style}
            value={children}
            onClick={this.handleSelectText}
          />
        </OverflowContainer>
        <Clipboard hideUnsupported onClick={this.handleCopyClick} value={children}>
          <StyledCopyButton type="button" size="xsmall" onClick={this.handleCopyClick}>
            <InlineSvg src="icon-clipboard" size="1.25em" />
          </StyledCopyButton>
        </Clipboard>
      </Flex>
    );
  }
}

export default TextCopyInput;
