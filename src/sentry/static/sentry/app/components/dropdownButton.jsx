import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import Button from 'app/components/button';
import InlineSvg from 'app/components/inlineSvg';
import omit from 'lodash/omit';

class DropdownButton extends React.Component {
  static propTypes = {
    isOpen: PropTypes.bool,
    showChevron: PropTypes.bool,
  };
  render() {
    const {isOpen, showChevron, children, ...otherProps} = this.props;
    return (
      <StyledButton type="button" isOpen={isOpen} {...otherProps}>
        {children}
        {showChevron && <StyledChevronDown />}
      </StyledButton>
    );
  }
}

DropdownButton.defaultProps = {
  showChevron: true,
};

const StyledChevronDown = styled(props => (
  <InlineSvg src="icon-chevron-down" {...props} />
))`
  margin-left: 0.33em;
`;

const StyledButton = styled(
  React.forwardRef((props, ref) => {
    const forwardProps = omit(props, ['isOpen']);
    return <Button innerRef={ref} {...forwardProps} />;
  })
)`
  border-bottom-right-radius: ${p => (p.isOpen ? 0 : p.theme.borderRadius)};
  border-bottom-left-radius: ${p => (p.isOpen ? 0 : p.theme.borderRadius)};
  position: relative;
  z-index: 2;
  box-shadow: ${p => (p.isOpen || p.disabled ? 'none' : p.theme.dropShadowLight)};
  border-bottom-color: ${p => (p.isOpen ? 'transparent' : p.theme.borderDark)};

  &:active,
  &:focus,
  &:hover {
    border-bottom-color: ${p => (p.isOpen ? 'transparent' : p.theme.borderDark)};
  }
`;

export default DropdownButton;
