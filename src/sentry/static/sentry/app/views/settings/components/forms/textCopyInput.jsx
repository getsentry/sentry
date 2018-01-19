import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import styled from 'react-emotion';

import {inputStyles} from './styled/styles';
import {selectText} from '../../../../utils/selectText';
import AutoSelectText from '../../../../components/autoSelectText';
import Button from '../../../../components/buttons/button';
import Clipboard from '../../../../components/clipboard';
import InlineSvg from '../../../../components/inlineSvg';

const Wrapper = styled(Flex)`
  display: flex;
  max-width: 600px;
`;

const OverflowContainer = styled('div')`
  flex-grow: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: ${p => p.theme.offWhite};
  border: 1px solid ${p => p.theme.borderLight};
  border-right-width: 0;
  border-radius: 0.25em 0 0 0.25em;
  padding: 0.25em 1em;
  box-shadow: 0 2px rgba(0, 0, 0, 0.05);
`;

const StyledCopyButton = styled(Button)`
  flex-shrink: 1;
  border-radius: 0 0.25em 0.25em 0;
`;

const StyledAutoSelectText = styled(AutoSelectText)`
  ${inputStyles};
  display: inline-block;
  width: 100%;
  padding: 0;
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

    // We use findDOMNode here because `this.textRef` is not a dom node,
    // it's a ref to AutoSelectText
    // eslint-disable-next-line react/no-find-dom-node
    selectText(ReactDOM.findDOMNode(this.textRef));

    onCopy(this.props.children, e);

    e.stopPropagation();
  };

  handleAutoMount = ref => {
    this.textRef = ref;
  };

  render() {
    let {style, children} = this.props;

    return (
      <Wrapper>
        <OverflowContainer>
          <StyledAutoSelectText innerRef={this.handleAutoMount} style={style}>
            {children}
          </StyledAutoSelectText>
        </OverflowContainer>
        <Clipboard hideUnsupported onClick={this.handleCopyClick} value={children}>
          <StyledCopyButton size="xsmall" onClick={this.handleCopyClick}>
            <InlineSvg src="icon-clipboard" size="1.25em" />
          </StyledCopyButton>
        </Clipboard>
      </Wrapper>
    );
  }
}

export default TextCopyInput;
