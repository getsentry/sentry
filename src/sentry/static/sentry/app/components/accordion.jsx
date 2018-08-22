import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';
import {Flex} from 'grid-emotion';
import Badge from 'app/components/badge';
import Button from 'app/components/buttons/button';

class AccordionButton extends React.Component {
  static propTypes = {
    label: PropTypes.string.isRequired,
    cutoff: PropTypes.number,
    children: PropTypes.arrayOf(PropTypes.node).isRequired,
  };

  static defaultProps = {
    cutoff: 0,
  };

  constructor(props, context) {
    super(props, context);

    this.state = {
      isOpen: false,
    };
  }

  handleClick(e) {
    e.preventDefault();
    this.setState({isOpen: !this.state.isOpen});
  }

  render() {
    const {label, cutoff, children} = this.props;

    if (children.length <= cutoff + 1) return children;

    return (
      <div>
        {children.slice(0, cutoff)}
        <StyledButton onClick={e => this.handleClick(e)} open={this.state.isOpen}>
          <Flex align="center" justify="space-between" w={1}>
            <Flex align="center">
              {label}
              <Badge style={{marginLeft: space(0.25)}} text={children.length - cutoff} />
            </Flex>
            <StyledInlineSvg src="icon-chevron-down" open={this.state.isOpen} />
          </Flex>
        </StyledButton>
        {this.state.isOpen && children.slice(cutoff)}
      </div>
    );
  }
}

const StyledButton = styled(Button)`
  display: block;
  width: 100%;
  box-shadow: ${p => (p.open ? 'inset -2px 2px rgba(0,0,0,0.04)' : null)};
  border: 1px solid ${p => p.theme.offWhite2};
  color: ${p => p.theme.gray4};
  margin: 1em 0;

  &,
  &:focus {
    background: ${p => p.theme.offWhite};
  }

  &:hover {
    color: ${p => p.theme.gray5};
    background: ${p => p.theme.offWhite2};
    border-color: ${p => p.theme.gray1};
  }
`;

const StyledInlineSvg = styled(InlineSvg)`
  transform: rotate(${p => (p.open ? '180deg' : null)});
`;

export default AccordionButton;
