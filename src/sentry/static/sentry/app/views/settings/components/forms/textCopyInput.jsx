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

const StyledAutoSelectText = styled(AutoSelectText)`
  ${inputStyles};
  display: inline-block;
  width: auto;
  padding: 0;
`;

const OverflowContainer = styled(Flex)`
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Wrapper = styled(Flex)`
  overflow: hidden;
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
        <OverflowContainer flex="1">
          <StyledAutoSelectText innerRef={this.handleAutoMount} style={style}>
            {children}
          </StyledAutoSelectText>
        </OverflowContainer>
        <Clipboard hideUnsupported onClick={this.handleCopyClick} value={children}>
          <Flex shrink="0">
            <Button borderless size="xsmall" onClick={this.handleCopyClick}>
              <InlineSvg src="icon-copy" />
            </Button>
          </Flex>
        </Clipboard>
      </Wrapper>
    );
  }
}

export default TextCopyInput;
