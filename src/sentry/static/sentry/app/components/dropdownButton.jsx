import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';
import styled from 'react-emotion';
import Button from './buttons/button';
import InlineSvg from './inlineSvg';
import DropdownAutoComplete from './dropdownAutoComplete';

class DropdownButton extends React.Component {
  static propTypes = {
    items: PropTypes.arrayOf(PropTypes.object),
    onSelect: PropTypes.func,
  };

  constructor(props) {
    super(props);

    this.state = {
      isOpen: false,
      closedOnBlur: false,
    };
  }

  toggleOpen = _.throttle(() => {
    this.setState({isOpen: !this.state.isOpen});
  }, 1);

  onSelect = selectedItem => {
    this.toggleOpen();
    if (this.props.onSelect) this.props.onSelect(selectedItem);
  };

  render() {
    return (
      <div style={{position: 'relative', display: 'inline-block'}}>
        {this.state.isOpen && (
          <StyledMenu>
            <DropdownAutoComplete
              items={this.props.items}
              onBlur={this.toggleOpen}
              onSelect={this.onSelect}
            />
          </StyledMenu>
        )}
        <div
          style={{pointerEvents: this.state.isOpen ? 'none' : 'auto'}}
          onClick={this.toggleOpen}
          ref={button => (this.button = button)}
        >
          <StyledButton isOpen={this.state.isOpen}>
            <StyledChevronDown />
            Add Something
          </StyledButton>
        </div>
      </div>
    );
  }
}

const StyledChevronDown = styled(props => (
  <InlineSvg src="icon-chevron-down" {...props} />
))`
  margin-right: 0.5em;
`;

const StyledMenu = styled('div')`
  background: #fff;
  border: 1px solid ${p => p.theme.borderLight};
  border-radius: 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius}
    ${p => p.theme.borderRadius};
  position: absolute;
  top: calc(100% - 1px);
  left: 0;
  min-width: 250px;
  font-size: 0.9em;
`;

const StyledButton = styled(props => <Button {...props} />)`
  border-bottom-right-radius: ${p => (p.isOpen ? 0 : p.theme.borderRadius)};
  border-bottom-left-radius: ${p => (p.isOpen ? 0 : p.theme.borderRadius)};
  position: relative;
  z-index; 1;
  box-shadow: none;

  &, &:hover { border-bottom-color: ${p =>
    p.isOpen ? 'transparent' : p.theme.borderDark};}
`;

export default DropdownButton;
